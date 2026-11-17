/**
 * Tests for paged attestation ingestion with a (timeCreated, id) keyset cursor.
 */

const mockApolloClient = { query: jest.fn() };

jest.mock('@apollo/client/core', () => ({
  ApolloClient: jest.fn(() => mockApolloClient),
  InMemoryCache: jest.fn(),
  gql: jest.fn((query: TemplateStringsArray | string) => (Array.isArray(query) ? query.join('') : query)),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../src/config', () => ({
  config: {
    EAS_SCHEMA_UID: '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2',
  },
  easEndpoints: { base: 'https://base.easscan.org/graphql' },
}));

jest.mock('../../src/services/supabase.service', () => ({
  supabaseService: { isAvailable: jest.fn(() => false) },
}));

import { EasService } from '../../src/services/eas.service';
import { DbService } from '../../src/services/db.service';

const PAGE = EasService.INGEST_PAGE_SIZE;
const START = 1_700_000_000;

const uid = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

/** An attestation as EAS returns it; `second` offsets timeCreated from START. */
function attestation(n: number, second = n) {
  return {
    id: uid(n),
    attester: '0xattester',
    recipient: '0xrecipient',
    revocationTime: 0,
    revoked: false,
    timeCreated: START + second,
    data: '0x',
    decodedDataJson: JSON.stringify([
      { name: 'srs', type: 'string', value: { value: 'EPSG:4326' } },
      { name: 'locationType', type: 'string', value: { value: 'DecimalDegrees<string>' } },
      { name: 'location', type: 'string', value: { value: '-71.1, 42.3' } },
    ]),
  };
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

/** Queue EAS pages for successive queries. */
function queuePages(...pages: Array<ReturnType<typeof attestation>[]>) {
  for (const page of pages) {
    mockApolloClient.query.mockResolvedValueOnce({ data: { attestations: page } });
  }
}

const queryVariables = (call: number) => mockApolloClient.query.mock.calls[call][0].variables;

describe('EasService.processChain pagination', () => {
  let db: {
    locationProofExists: jest.Mock;
    createLocationProof: jest.Mock;
    getLatestLocationProofTimestamp: jest.Mock;
  };
  let easService: EasService;
  const savedBudget = process.env.INGEST_TIME_BUDGET_MS;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApolloClient.query.mockReset();
    delete process.env.INGEST_TIME_BUDGET_MS;
    db = {
      locationProofExists: jest.fn().mockResolvedValue(false),
      createLocationProof: jest.fn().mockResolvedValue(undefined),
      getLatestLocationProofTimestamp: jest.fn().mockResolvedValue(new Date(START * 1000)),
    };
    easService = new EasService(db as unknown as DbService);
    await easService.initialize();
  });

  afterAll(() => {
    if (savedBudget === undefined) delete process.env.INGEST_TIME_BUDGET_MS;
    else process.env.INGEST_TIME_BUDGET_MS = savedBudget;
  });

  it('drains a backlog across pages in one run', async () => {
    queuePages(
      range(1, PAGE).map(n => attestation(n)),
      range(PAGE + 1, PAGE).map(n => attestation(n)),
      range(2 * PAGE + 1, 5).map(n => attestation(n))
    );

    const stored = await easService.processChain('base');

    expect(stored).toBe(2 * PAGE + 5);
    expect(mockApolloClient.query).toHaveBeenCalledTimes(3);
    expect(db.createLocationProof).toHaveBeenCalledTimes(2 * PAGE + 5);
  });

  it('starts at the stored second inclusive, then pages after (timeCreated, id)', async () => {
    queuePages(range(1, PAGE).map(n => attestation(n)), []);

    await easService.processChain('base');

    // First page after initialize: inclusive from the newest stored second, no id
    expect(queryVariables(0)).toEqual(expect.objectContaining({ timeCreated: START, take: PAGE }));
    expect(queryVariables(0)).not.toHaveProperty('id');
    // Next page continues strictly after the last attestation
    expect(queryVariables(1)).toEqual(
      expect.objectContaining({ timeCreated: START + PAGE, id: uid(PAGE), take: PAGE })
    );
  });

  it('does not skip attestations that share a second across a page boundary', async () => {
    // The last 3 attestations of page 1 and the first 2 of page 2 share one second
    const shared = 500;
    const page1 = [...range(1, PAGE - 3).map(n => attestation(n)), ...range(PAGE - 2, 3).map(n => attestation(n, shared))];
    const page2 = range(PAGE + 1, 2).map(n => attestation(n, shared));
    queuePages(page1, page2);

    const stored = await easService.processChain('base');

    expect(queryVariables(1)).toEqual(expect.objectContaining({ timeCreated: START + shared, id: uid(PAGE) }));
    expect(stored).toBe(PAGE + 2);
    const storedUids = db.createLocationProof.mock.calls.map(([proof]) => proof.uid);
    expect(storedUids).toEqual(expect.arrayContaining([uid(PAGE + 1), uid(PAGE + 2)]));
  });

  it('skips attestations that are already stored without re-inserting them', async () => {
    db.locationProofExists.mockImplementation(async (id: string) => id === uid(1) || id === uid(2));
    queuePages(range(1, 4).map(n => attestation(n)));

    const stored = await easService.processChain('base');

    expect(stored).toBe(2);
    expect(db.createLocationProof).toHaveBeenCalledTimes(2);
  });

  it('stops on a storage failure without advancing past the unstored attestation', async () => {
    db.createLocationProof.mockImplementation(async (proof: { uid: string }) => {
      if (proof.uid === uid(5)) throw new Error('insert failed');
    });
    queuePages(range(1, PAGE).map(n => attestation(n)));

    await expect(easService.processChain('base')).rejects.toThrow('insert failed');
    expect(db.createLocationProof).toHaveBeenCalledTimes(5);

    // The next run resumes right after attestation 4, so 5 is retried
    db.createLocationProof.mockResolvedValue(undefined);
    queuePages([attestation(5), attestation(6)]);
    await easService.processChain('base');
    expect(queryVariables(1)).toEqual(expect.objectContaining({ timeCreated: START + 4, id: uid(4) }));
  });

  it('skips an attestation that cannot be converted and keeps going', async () => {
    const convert = jest.spyOn(easService, 'convertAttestationToLocationProof');
    convert.mockImplementationOnce(async () => {
      throw new Error('bad payload');
    });
    queuePages(range(1, 3).map(n => attestation(n)));

    const stored = await easService.processChain('base');

    expect(stored).toBe(2);
    convert.mockRestore();
  });

  it('skips attestations EAS could not decode (empty decodedDataJson)', async () => {
    const undecodable = { ...attestation(2), decodedDataJson: '' };
    queuePages([attestation(1), undecodable, attestation(3)]);

    const stored = await easService.processChain('base');

    expect(stored).toBe(2);
    const storedUids = db.createLocationProof.mock.calls.map(([proof]) => proof.uid);
    expect(storedUids).toEqual([uid(1), uid(3)]);
  });

  it('stops after the time budget and resumes from the cursor next run', async () => {
    process.env.INGEST_TIME_BUDGET_MS = '1';
    mockApolloClient.query.mockImplementation(async ({ variables }: { variables: { id?: string } }) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      const from = variables.id ? parseInt(variables.id, 16) + 1 : 1;
      return { data: { attestations: range(from, PAGE).map(n => attestation(n)) } };
    });

    const stored = await easService.processChain('base');

    expect(mockApolloClient.query).toHaveBeenCalledTimes(1);
    expect(stored).toBe(PAGE);

    await easService.processChain('base');
    expect(queryVariables(1)).toEqual(expect.objectContaining({ id: uid(PAGE) }));
  });

  it('retries a failed page fetch before giving up', async () => {
    mockApolloClient.query
      .mockRejectedValueOnce(new Error('terminated'))
      .mockResolvedValueOnce({ data: { attestations: [attestation(1)] } });

    const stored = await easService.processChain('base');

    expect(stored).toBe(1);
    expect(mockApolloClient.query).toHaveBeenCalledTimes(2);
  });

  it('processAllChains reports 0 for a failing chain instead of throwing', async () => {
    mockApolloClient.query.mockRejectedValue(new Error('down'));
    jest.spyOn(easService, 'fetchAttestationPage').mockRejectedValue(new Error('down'));

    await expect(easService.processAllChains()).resolves.toEqual({ base: 0 });
  });
});
