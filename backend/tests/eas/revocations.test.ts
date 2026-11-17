/**
 * Tests for revocation handling: the revoked check, EAS revocation queries,
 * and the worker's reconciliation of stored revoked flags.
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
  easEndpoints: {
    arbitrum: 'https://arbitrum.easscan.org/graphql',
    celo: 'https://celo.easscan.org/graphql',
    sepolia: 'https://sepolia.easscan.org/graphql',
    base: 'https://base.easscan.org/graphql',
  },
}));

jest.mock('../../src/services/db.service');

import { EasService, isAttestationRevoked } from '../../src/services/eas.service';
import { DbService } from '../../src/services/db.service';

const SCHEMA_UID = '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2';

/** Build an attestation as the EAS GraphQL indexer returns it. */
function easAttestation(id: string, revocationTime: number) {
  return {
    id,
    attester: '0xattester',
    recipient: '0xrecipient',
    revocationTime,
    revoked: revocationTime > 0,
    timeCreated: '1700000000',
    data: '0x',
    decodedDataJson: JSON.stringify([
      { name: 'eventTimestamp', type: 'uint256', value: { value: 1700000000 } },
      { name: 'srs', type: 'string', value: { value: 'EPSG:4326' } },
      { name: 'locationType', type: 'string', value: { value: 'DecimalDegrees<string>' } },
      { name: 'location', type: 'string', value: { value: '-71.1, 42.3' } },
    ]),
  };
}

const uid = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

describe('isAttestationRevoked', () => {
  it.each([
    [{ revocationTime: 0 }, false],
    [{ revocationTime: '0' }, false],
    [{ revocationTime: 1679132652 }, true],
    [{ revocationTime: '1679132652' }, true],
    [{ revocationTime: null }, false],
    [{}, false],
    [{ revoked: true, revocationTime: 0 }, true],
    [{ revoked: false, revocationTime: 1679132652 }, false],
  ])('%j -> %s', (attestation, expected) => {
    expect(isAttestationRevoked(attestation)).toBe(expected);
  });
});

describe('EasService revocation queries', () => {
  let easService: EasService;

  beforeEach(() => {
    jest.clearAllMocks();
    easService = new EasService({} as unknown as DbService);
  });

  it('stores numeric revocationTime 0 from EAS as not revoked', async () => {
    const proof = await easService.convertAttestationToLocationProof(
      easAttestation(uid(1), 0) as never,
      'base'
    );
    expect(proof.revoked).toBe(false);
  });

  it('stores a revoked attestation as revoked', async () => {
    const proof = await easService.convertAttestationToLocationProof(
      easAttestation(uid(1), 1679132652) as never,
      'base'
    );
    expect(proof.revoked).toBe(true);
  });

  it('pages through revoked attestations with a cursor', async () => {
    const firstPage = Array.from({ length: EasService.REVOCATION_PAGE_SIZE }, (_, i) => ({ id: uid(i) }));
    const secondPage = [{ id: uid(1000) }, { id: uid(1001) }];
    mockApolloClient.query
      .mockResolvedValueOnce({ data: { attestations: firstPage } })
      .mockResolvedValueOnce({ data: { attestations: secondPage } });

    const uids = await easService.fetchRevokedAttestationUids('base');

    expect(uids).toHaveLength(EasService.REVOCATION_PAGE_SIZE + 2);
    expect(mockApolloClient.query).toHaveBeenCalledTimes(2);
    expect(mockApolloClient.query.mock.calls[0][0].variables).toEqual({
      schemaId: SCHEMA_UID,
      take: EasService.REVOCATION_PAGE_SIZE,
    });
    expect(mockApolloClient.query.mock.calls[1][0].variables).toEqual({
      schemaId: SCHEMA_UID,
      take: EasService.REVOCATION_PAGE_SIZE,
      cursor: uid(EasService.REVOCATION_PAGE_SIZE - 1),
    });
  });

  it('stops after one query when the first page is short', async () => {
    mockApolloClient.query.mockResolvedValueOnce({ data: { attestations: [] } });
    await expect(easService.fetchRevokedAttestationUids('base')).resolves.toEqual([]);
    expect(mockApolloClient.query).toHaveBeenCalledTimes(1);
  });

  it('throws instead of returning a partial list when a page fails', async () => {
    const fullPage = Array.from({ length: EasService.REVOCATION_PAGE_SIZE }, (_, i) => ({ id: uid(i) }));
    mockApolloClient.query
      .mockResolvedValueOnce({ data: { attestations: fullPage } })
      .mockRejectedValueOnce(new Error('terminated'));
    await expect(easService.fetchRevokedAttestationUids('base')).rejects.toThrow('terminated');
  });

  it('throws when the page limit is exceeded', async () => {
    let n = 0;
    mockApolloClient.query.mockImplementation(async () => ({
      data: {
        attestations: Array.from({ length: EasService.REVOCATION_PAGE_SIZE }, () => ({ id: uid(n++) })),
      },
    }));
    await expect(easService.fetchRevokedAttestationUids('base')).rejects.toThrow('exceeded');
    expect(mockApolloClient.query).toHaveBeenCalledTimes(EasService.MAX_REVOCATION_PAGES);
    mockApolloClient.query.mockReset();
  });

  it('throws for an unconfigured chain', async () => {
    await expect(easService.fetchRevokedAttestationUids('optimism')).rejects.toThrow('not supported');
  });

  it('looks up statuses by UID in batches and maps numeric revocationTime', async () => {
    const uids = Array.from({ length: 250 }, (_, i) => uid(i));
    mockApolloClient.query.mockImplementation(async ({ variables }: { variables: { uids: string[] } }) => ({
      data: {
        attestations: variables.uids
          .filter(id => id !== uid(5)) // uid(5) unknown to EAS
          .map(id => ({ id, revocationTime: id === uid(7) ? 1679132652 : 0 })),
      },
    }));

    const statuses = await easService.getRevocationStatuses('base', uids);

    expect(mockApolloClient.query).toHaveBeenCalledTimes(3);
    expect(statuses.get(uid(7))).toBe(true);
    expect(statuses.get(uid(8))).toBe(false);
    expect(statuses.has(uid(5))).toBe(false);
    await expect(easService.checkRevocationStatus('base', [uid(7), uid(8)])).resolves.toEqual([uid(7)]);
    mockApolloClient.query.mockReset();
  });
});

describe('EasWorker.checkRevocations', () => {
  const mockSupabase = {
    initialize: jest.fn(),
    isAvailable: jest.fn(() => false),
    getClient: jest.fn(() => null),
    batchUpdateRevocations: jest.fn(),
    getRevokedLocationProofUids: jest.fn(),
  };

  // Loaded in isolation so the module-level supabase mock applies
  function createWorker() {
    jest.resetModules();
    jest.doMock('../../src/services/supabase.service', () => ({ supabaseService: mockSupabase }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EasWorker } = require('../../src/workers/eas-worker');
    const worker = new EasWorker();
    const easService = {
      getGraphQLClients: jest.fn((): Record<string, object> => ({ base: {}, sepolia: {} })),
      fetchRevokedAttestationUids: jest.fn(),
      getRevocationStatuses: jest.fn(),
    };
    const dbService = {
      getRevokedLocationProofUids: jest.fn(),
      batchUpdateRevocations: jest.fn(async (uids: string[]) => uids.length),
    };
    Object.assign(worker, { easService, dbService });
    return { worker, easService, dbService };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.isAvailable.mockReturnValue(false);
  });

  it('flags newly revoked proofs and clears wrongly flagged ones', async () => {
    const { worker, easService, dbService } = createWorker();
    easService.getGraphQLClients.mockReturnValue({ base: {} });
    // EAS: A and B revoked. DB: B, C, D, E flagged revoked.
    easService.fetchRevokedAttestationUids.mockResolvedValue(['A', 'B']);
    dbService.getRevokedLocationProofUids.mockResolvedValue(['B', 'C', 'D', 'E']);
    // C, D not revoked on EAS; E unknown to EAS (left untouched)
    easService.getRevocationStatuses.mockResolvedValue(new Map([['C', false], ['D', false]]));

    await worker.checkRevocations();

    expect(easService.getRevocationStatuses).toHaveBeenCalledWith('base', ['C', 'D', 'E']);
    expect(dbService.batchUpdateRevocations).toHaveBeenCalledWith(['A'], true);
    expect(dbService.batchUpdateRevocations).toHaveBeenCalledWith(['C', 'D'], false);
    const { revocationChecks } = (worker as unknown as {
      stats: { revocationChecks: { revokedCount: number; restoredCount: number; checkedCount: number } };
    }).stats;
    expect(revocationChecks.revokedCount).toBe(1);
    expect(revocationChecks.restoredCount).toBe(2);
    expect(revocationChecks.checkedCount).toBe(5); // 2 revoked on EAS + 3 restore candidates
  });

  it('does nothing when EAS and the database agree', async () => {
    const { worker, easService, dbService } = createWorker();
    easService.getGraphQLClients.mockReturnValue({ base: {} });
    easService.fetchRevokedAttestationUids.mockResolvedValue(['A']);
    dbService.getRevokedLocationProofUids.mockResolvedValue(['A']);

    await worker.checkRevocations();

    expect(easService.getRevocationStatuses).not.toHaveBeenCalled();
    expect(dbService.batchUpdateRevocations).not.toHaveBeenCalled();
  });

  it('skips a chain whose EAS scan fails without touching its rows, and continues', async () => {
    const { worker, easService, dbService } = createWorker();
    easService.fetchRevokedAttestationUids
      .mockRejectedValueOnce(new Error('EAS down'))
      .mockResolvedValueOnce(['S1']);
    dbService.getRevokedLocationProofUids.mockResolvedValue([]);

    await worker.checkRevocations();

    expect(dbService.getRevokedLocationProofUids).toHaveBeenCalledTimes(1);
    expect(dbService.getRevokedLocationProofUids).toHaveBeenCalledWith('sepolia');
    expect(dbService.batchUpdateRevocations).toHaveBeenCalledTimes(1);
    expect(dbService.batchUpdateRevocations).toHaveBeenCalledWith(['S1'], true);
  });

  it('skips a chain when the stored-revocations read fails', async () => {
    const { worker, easService, dbService } = createWorker();
    easService.getGraphQLClients.mockReturnValue({ base: {} });
    easService.fetchRevokedAttestationUids.mockResolvedValue(['A']);
    dbService.getRevokedLocationProofUids.mockRejectedValue(new Error('db down'));

    await worker.checkRevocations();

    expect(dbService.batchUpdateRevocations).not.toHaveBeenCalled();
  });

  it('writes through Supabase when it is available', async () => {
    const { worker, easService, dbService } = createWorker();
    mockSupabase.isAvailable.mockReturnValue(true);
    mockSupabase.batchUpdateRevocations.mockResolvedValue(1);
    easService.getGraphQLClients.mockReturnValue({ base: {} });
    easService.fetchRevokedAttestationUids.mockResolvedValue(['A']);
    dbService.getRevokedLocationProofUids.mockResolvedValue([]);

    await worker.checkRevocations();

    expect(mockSupabase.batchUpdateRevocations).toHaveBeenCalledWith(['A'], true);
    expect(dbService.batchUpdateRevocations).not.toHaveBeenCalled();
  });
});
