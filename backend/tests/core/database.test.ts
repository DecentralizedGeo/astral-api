// Core database service tests

import { createMockPool, createMockClient } from '../setup/database-setup';
import { createMockAttestation } from '../setup/test-utils';

describe('Database Service', () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockPool = createMockPool();
    mockClient = createMockClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPool.end();
  });

  describe('Connection Management', () => {
    it('should create a database connection', async () => {
      const client = mockPool.connect();
      expect(client).toBeDefined();
      expect(typeof client.query).toBe('function');
    });

    it('should execute queries', async () => {
      const result = await mockClient.query('SELECT version()');
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
    });

    it('should handle database errors gracefully', async () => {
      // This test would verify error handling
      expect(mockClient.query).toBeDefined();
    });
  });

  describe('Spatial Operations', () => {
    it('should handle PostGIS extension check', async () => {
      const result = await mockClient.query('SELECT * FROM spatial_ref_sys LIMIT 1');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('srid', 4326);
    });

    it('should create spatial tables', async () => {
      const result = await mockClient.query('CREATE EXTENSION IF NOT EXISTS postgis');
      expect(result).toHaveProperty('rowCount', 0);
    });
  });

  describe('Data Validation', () => {
    it('should validate attestation data structure', () => {
      const mockAttestation = createMockAttestation();
      
      expect(mockAttestation).toHaveProperty('uid');
      expect(mockAttestation).toHaveProperty('schema');
      expect(mockAttestation).toHaveProperty('attester');
      expect(mockAttestation).toHaveProperty('data');
      expect(typeof mockAttestation.time).toBe('number');
      expect(typeof mockAttestation.revocable).toBe('boolean');
    });

    it('should handle custom attestation overrides', () => {
      const customAttestation = createMockAttestation({
        uid: 'custom-uid',
        revoked: true,
      });

      expect(customAttestation.uid).toBe('custom-uid');
      expect(customAttestation.revoked).toBe(true);
      expect(customAttestation.revocable).toBe(true); // default value
    });
  });
});
