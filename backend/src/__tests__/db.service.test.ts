import { Pool } from 'pg';

// Mock the config module
jest.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgres://user:password@localhost:5432/testdb',
  }
}));

import { dbService } from '../services/db.service';

// Mock the PostgreSQL Pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn().mockResolvedValue({}),
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock the pool responses
const mockPoolQuery = (Pool as unknown as jest.Mock).mock.results[0].value.query;

describe('Database Service', () => {
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check if location proof exists', async () => {
    const mockUid = '0x1234567890abcdef';
    
    // Mock the pool query response for a found proof
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ exists: true }] });
    
    const exists = await dbService.locationProofExists(mockUid);
    
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM location_proofs WHERE uid = $1'),
      [mockUid]
    );
    expect(exists).toBe(true);
  });

  test('should return null when location proof not found', async () => {
    const mockUid = '0x1234567890abcdef';
    
    // Mock the pool query response for a non-existent proof
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    
    const proof = await dbService.getLocationProofByUid(mockUid);
    
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM location_proofs WHERE uid = $1'),
      [mockUid]
    );
    expect(proof).toBeNull();
  });

  test('should query location proofs with filters', async () => {
    const params = {
      chain: 'arbitrum',
      prover: '0xabcdef',
      bbox: [1, 2, 3, 4] as [number, number, number, number],
      limit: 10
    };
    
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    
    await dbService.queryLocationProofs(params);
    
    // Verify the query contains filters for chain, prover, and bbox
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND chain = $1'),
      expect.arrayContaining([params.chain, params.prover, ...params.bbox, params.limit])
    );
  });
});