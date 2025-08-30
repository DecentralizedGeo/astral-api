/* eslint-disable @typescript-eslint/no-explicit-any */
// import { Pool } from 'pg';

// Mock the config module
jest.mock('../../src/config', () => ({
  config: {
    DATABASE_URL: 'postgres://user:password@localhost:5432/testdb',
  }
}));

// Mock pg Pool
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  end: jest.fn(),
  query: jest.fn(),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

import { SchemaValidator } from '../../src/scripts/validate-schema';

// Shared full schema mocks for all tests
const fullLocationProofsColumns = [
  { column_name: 'id', data_type: 'bigint', is_nullable: 'NO', column_default: null },
  { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
  { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
  { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO', column_default: null },
  { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES', column_default: null },
  { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
  { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
  { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES', column_default: null },
  { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
  { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: null },
  { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
  { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
  { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
  { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'memo', data_type: 'text', is_nullable: 'YES', column_default: null },
  { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES', column_default: null },
  { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
  { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
];
const fullWorkerStatsColumns = [
  { column_name: 'id', data_type: 'bigint', is_nullable: 'NO', column_default: null },
  { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
  { column_name: 'start_time', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
  { column_name: 'last_successful_run', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
  { column_name: 'last_run_duration', data_type: 'double precision', is_nullable: 'YES', column_default: null },
  { column_name: 'total_runs', data_type: 'integer', is_nullable: 'YES', column_default: null },
  { column_name: 'successful_runs', data_type: 'integer', is_nullable: 'YES', column_default: null },
  { column_name: 'failed_runs', data_type: 'integer', is_nullable: 'YES', column_default: null },
  { column_name: 'total_attestations_ingested', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'last_run_attestations_ingested', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'errors', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'revocation_last_run', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
  { column_name: 'revocation_checked_count', data_type: 'integer', is_nullable: 'YES', column_default: null },
  { column_name: 'revocation_revoked_count', data_type: 'integer', is_nullable: 'YES', column_default: null },
  { column_name: 'is_running', data_type: 'boolean', is_nullable: 'YES', column_default: null },
  { column_name: 'is_revocation_check_running', data_type: 'boolean', is_nullable: 'YES', column_default: null },
];
const fullSyncHistoryColumns = [
  { column_name: 'id', data_type: 'bigint', is_nullable: 'NO', column_default: null },
  { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
  { column_name: 'stats', data_type: 'jsonb', is_nullable: 'NO', column_default: null },
];
const fullLocationProofsIndexes = [
  { indexname: 'idx_location_proofs_chain', indexdef: 'CREATE INDEX...' },
  { indexname: 'idx_location_proofs_prover', indexdef: 'CREATE INDEX...' },
  { indexname: 'idx_location_proofs_event_timestamp', indexdef: 'CREATE INDEX...' },
  { indexname: 'idx_location_proofs_geometry', indexdef: 'CREATE INDEX...' },
];
const fullWorkerStatsIndexes = [];
const fullSyncHistoryIndexes = [
  { indexname: 'idx_sync_history_created_at', indexdef: 'CREATE INDEX...' },
];

describe('Schema Validator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new SchemaValidator();
    
    // Reset mock implementations
    mockClient.query.mockResolvedValue({ rows: [] });
    mockPool.query.mockResolvedValue({ rows: [] });
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Ensure all database connections are properly closed
    if (mockPool.end && typeof mockPool.end === 'function') {
      await mockPool.end();
    }
    if (mockClient.release && typeof mockClient.release === 'function') {
      await mockClient.release();
    }
    // Force Jest to exit cleanly
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('getCurrentSchema', () => {
    it('should retrieve current database schema', async () => {
      // Mock table information - first query gets tables
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'location_proofs' }
          ]
        })
        .mockResolvedValueOnce({ // columns query for location_proofs
          rows: [
            { column_name: 'id', data_type: 'bigint', is_nullable: 'NO', column_default: null },
            { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'geom', data_type: 'geometry', is_nullable: 'YES', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ // indexes query for location_proofs
          rows: [
            { indexname: 'location_proofs_pkey', indexdef: 'CREATE UNIQUE INDEX...' },
            { indexname: 'idx_location_proofs_geom', indexdef: 'CREATE INDEX...' },
          ]
        });

      const schema = await (validator as any).getCurrentSchema();

      expect(schema).toHaveProperty('tables');
      expect(schema).toHaveProperty('columns');
      expect(schema).toHaveProperty('indexes');
      expect(schema.tables).toContain('location_proofs');
      expect(schema.columns.location_proofs).toHaveLength(3);
      expect(Object.keys(schema.indexes)).toHaveLength(1);
    });

    it('should handle database connection errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect((validator as any).getCurrentSchema()).rejects.toThrow('Connection failed');
    });

    it('should handle query errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect((validator as any).getCurrentSchema()).rejects.toThrow('Query failed');
    });
  });

  describe('validateSchema', () => {
    it('should return empty array for matching schema', async () => {
      // Mock perfect schema match with all expected columns and indexes
      mockClient.query
        .mockResolvedValueOnce({ // tables query
          rows: [{ table_name: 'location_proofs' }]
        })
        .mockResolvedValueOnce({ // columns query
          rows: [
            { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
            { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'memo', data_type: 'text', is_nullable: 'YES', column_default: null },
            { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES', column_default: null },
            { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ // indexes query
          rows: [
            { indexname: 'idx_location_proofs_chain', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_prover', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_event_timestamp', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_geometry', indexdef: 'CREATE INDEX...' },
          ]
        });

      const differences = await validator.validateSchema();

      expect(differences).toHaveLength(0);
    });

    it('should detect missing table', async () => {
      // Mock empty schema (no tables)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }); // No tables found

      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(0);
      expect(differences).toContainEqual(
        expect.objectContaining({
          type: 'missing_table'
        })
      );
    });

    it('should detect missing columns', async () => {
      // Mock table with missing columns
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'location_proofs' }] }) // table exists
        .mockResolvedValueOnce({ // only 2 columns instead of expected 20
          rows: [
            { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ rows: [] }); // No indexes

      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(0);
      expect(differences.some(d => 
        d.type === 'missing_column'
      )).toBe(true);
    });

    it('should detect missing indexes', async () => {
      // Mock complete table but missing indexes
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'location_proofs' }] }) // table exists
        .mockResolvedValueOnce({ // complete columns
          rows: [
            { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
            { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'memo', data_type: 'text', is_nullable: 'YES', column_default: null },
            { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES', column_default: null },
            { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ // missing indexes
          rows: [
            { indexname: 'some_other_index', indexdef: 'CREATE INDEX...' },
            // Missing the expected indexes
          ]
        });

      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(0);
      expect(differences.length).toBeGreaterThan(0);
      expect(differences.some(d => 
        d.type === 'missing_index'
      )).toBe(true);
    });

    it('should detect column type mismatches', async () => {
      // Mock table with wrong column types
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'location_proofs' }] }) // table exists
        .mockResolvedValueOnce({ // columns with wrong types
          rows: [
            { column_name: 'uid', data_type: 'text', is_nullable: 'NO', column_default: null }, // Should be character varying
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
            { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'longitude', data_type: 'integer', is_nullable: 'YES', column_default: null }, // Should be numeric
            { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'memo', data_type: 'text', is_nullable: 'YES', column_default: null },
            { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES', column_default: null },
            { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ // complete indexes
          rows: [
            { indexname: 'idx_location_proofs_chain', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_prover', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_event_timestamp', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_geometry', indexdef: 'CREATE INDEX...' },
          ]
        });

      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(0);
      expect(differences.some(d => 
        d.type === 'column_type_mismatch'
      )).toBe(true);
    });
  });

  describe('printDifferences', () => {
    it('should format differences for display', () => {
      const differences = [
        { type: 'missing_table', table: 'test_table', details: 'Table missing' },
        { type: 'missing_column', table: 'location_proofs', column: 'test_column', expected: 'varchar', details: 'Column missing' },
        { type: 'column_type_mismatch', table: 'location_proofs', column: 'id', expected: 'bigint', actual: 'integer', details: 'Type mismatch' },
      ];

      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (validator as any).printDifferences(differences);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.some(call => 
        call[0].includes('missing_table') && call[0].includes('test_table')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle empty differences array', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call printDifferences with empty array - it SHOULD call console.log with success message
      (validator as any).printDifferences([]);

      expect(consoleSpy).toHaveBeenCalledWith('✅ Database schema is up to date!');

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection timeout gracefully', async () => {
      mockPool.connect.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );

      await expect(validator.validateSchema()).rejects.toThrow('Connection timeout');
    });

    it('should handle malformed query results', async () => {
      // Mock malformed response
      mockClient.query.mockResolvedValueOnce({ rows: null });

      await expect(validator.validateSchema()).rejects.toBeDefined();
    });

    it('should clean up connections on error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query error'));

      try {
        await validator.validateSchema();
      } catch (error) {
        // Expected to throw
      }

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete database schema successfully', async () => {
      // Mock a complete, correct schema - must use 3-query format
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'location_proofs' }] }) // tables query
        .mockResolvedValueOnce({ // complete correct columns
          rows: [
            { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
            { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES', column_default: null },
            { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES', column_default: null },
            { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
            { column_name: 'memo', data_type: 'text', is_nullable: 'YES', column_default: null },
            { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES', column_default: null },
            { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
            { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
          ]
        })
        .mockResolvedValueOnce({ // complete correct indexes
          rows: [
            { indexname: 'idx_location_proofs_chain', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_prover', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_event_timestamp', indexdef: 'CREATE INDEX...' },
            { indexname: 'idx_location_proofs_geometry', indexdef: 'CREATE INDEX...' },
          ]
        });

      const differences = await validator.validateSchema();

      expect(differences).toHaveLength(0);
    });

    it('should detect multiple schema issues in one validation', async () => {
      // Mock incomplete schema with multiple issues
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ table_name: 'location_proofs' }] }) // table exists
        .mockResolvedValueOnce({ // incomplete columns with wrong types
          rows: [
            { column_name: 'uid', data_type: 'text', is_nullable: 'NO', column_default: null }, // Wrong type
            { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            // Missing most columns
          ]
        })
        .mockResolvedValueOnce({ rows: [] }); // No indexes

      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(5); // Multiple missing items
      
      // Check for specific types of differences
      const differenceTypes = differences.map(d => d.type);
      expect(differenceTypes).toContain('column_type_mismatch');
      expect(differenceTypes).toContain('missing_column');
      expect(differenceTypes).toContain('missing_index');
    });
  });
});
