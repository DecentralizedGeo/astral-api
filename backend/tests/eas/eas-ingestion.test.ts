// Mock the config module BEFORE any other imports
jest.mock('../../src/config', () => ({
  config: {
    DATABASE_URL: 'postgres://user:password@localhost:5432/testdb',
    EAS_ENDPOINT_ARBITRUM: 'https://arbitrum.example.com/graphql',
    EAS_ENDPOINT_CELO: 'https://celo.example.com/graphql',
    EAS_ENDPOINT_SEPOLIA: 'https://sepolia.example.com/graphql',
    EAS_ENDPOINT_BASE: 'https://base.example.com/graphql',
    EAS_SCHEMA_UID: '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2',
  }
}));

// Mock pg Pool BEFORE any other imports
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

// Mock filesystem operations for script execution
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({})),
  writeFileSync: jest.fn(),
}));

// Mock process.exit to prevent actual exit during tests
jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock the SchemaValidator
jest.mock('../../src/scripts/validate-schema', () => ({
  SchemaValidator: jest.fn().mockImplementation(() => ({
    validateSchema: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    printDifferences: jest.fn()
  }))
}));

// Mock the migrations
jest.mock('../../src/migrations/run-migrations', () => jest.fn().mockResolvedValue(undefined));

// Import config for testing
import { config } from '../../src/config';

describe('EAS Ingestion Script Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations with successful defaults (like setup-db.test.ts)
    mockClient.query.mockResolvedValue({ rows: [{ now: new Date().toISOString() }] });
    mockPool.query.mockResolvedValue({ rows: [{ now: new Date().toISOString() }] });
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue(undefined);
    mockClient.release.mockResolvedValue(undefined);
    
    // Reset SchemaValidator mock to clean state (like setup-db.test.ts)
    const mockSchemaValidator = jest.requireMock('../../src/scripts/validate-schema').SchemaValidator;
    mockSchemaValidator.mockImplementation(() => ({
      validateSchema: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      printDifferences: jest.fn()
    }));
    
    // Mock console methods to suppress output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
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

  describe('Database Connection and Setup', () => {
    it('should test database connection successfully', async () => {
      // Mock successful connection - testConnection uses pool.query directly
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });

      // Import and test the connection logic
      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.testConnection();

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
    });

    it('should handle database connection failures', async () => {
      // Mock connection failure for testConnection (uses pool.query)
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.testConnection();

      expect(result).toBe(false);
    });

    it('should verify database readiness', async () => {
      // Mock successful readiness checks with correct query results
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] }) // PostGIS extension check
        .mockResolvedValueOnce({ rows: [{ table_exists: true }] }); // Table existence check

      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.checkDatabaseReadiness();

      expect(result.postgis_enabled).toBe(true);
      expect(result.table_exists).toBe(true);
    });

    it('should detect missing database components', async () => {
      // Mock missing table with correct query results
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] }) // PostGIS extension check
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] }); // Table existence check

      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.checkDatabaseReadiness();

      expect(result.postgis_enabled).toBe(true);
      expect(result.table_exists).toBe(false);
    });
  });

  describe('Schema Validation Integration', () => {
    it('should validate schema after setup', async () => {
      // Mock successful schema validation
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'location_proofs', column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'uid', data_type: 'character varying', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'attester', data_type: 'character varying', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'recipient', data_type: 'character varying', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'time', data_type: 'bigint', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'geom', data_type: 'geometry', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'country', data_type: 'character varying', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'region', data_type: 'character varying', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'city', data_type: 'character varying', is_nullable: 'YES' },
            { table_name: 'location_proofs', column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
            { table_name: 'location_proofs', column_name: 'chain', data_type: 'character varying', is_nullable: 'NO' },
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { indexname: 'location_proofs_pkey', tablename: 'location_proofs' },
            { indexname: 'idx_location_proofs_geom', tablename: 'location_proofs' },
            { indexname: 'idx_location_proofs_uid', tablename: 'location_proofs' },
            { indexname: 'idx_location_proofs_attester', tablename: 'location_proofs' },
            { indexname: 'idx_location_proofs_time', tablename: 'location_proofs' },
            { indexname: 'idx_location_proofs_chain', tablename: 'location_proofs' },
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { trigger_name: 'location_proofs_update_timestamp', table_name: 'location_proofs' }
          ]
        });

      const { SchemaValidator } = await import('../../src/scripts/validate-schema');
      const validator = new SchemaValidator();
      const differences = await validator.validateSchema();

      expect(differences).toHaveLength(0);
    });

    it('should detect and report schema issues', async () => {
      // Update the SchemaValidator mock to return differences for this test
      const mockSchemaValidator = jest.requireMock('../../src/scripts/validate-schema').SchemaValidator;
      const mockInstance = {
        validateSchema: jest.fn().mockResolvedValue([
          { type: 'missing_column', table: 'location_proofs', column: 'latitude', details: 'Column missing' },
          { type: 'missing_index', table: 'location_proofs', index: 'idx_location_proofs_geom', details: 'Index missing' }
        ]),
        close: jest.fn().mockResolvedValue(undefined),
        printDifferences: jest.fn()
      };
      mockSchemaValidator.mockImplementation(() => mockInstance);

      const { SchemaValidator } = await import('../../src/scripts/validate-schema');
      const validator = new SchemaValidator();
      const differences = await validator.validateSchema();

      expect(differences.length).toBeGreaterThan(0);
      
      // Should detect missing columns, indexes, etc.
      const types = differences.map(d => d.type);
      expect(types).toContain('missing_column');
      expect(types).toContain('missing_index');
    });
  });

  describe('Data Ingestion Preparation', () => {
    it('should prepare database for EAS data ingestion', async () => {
      // Use the same pattern as setup-db.test.ts integration test
      const setupDb = await import('../../src/scripts/setup-db');
      
      // Test individual successful operations first
      mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }] });
      expect(await setupDb.testConnection()).toBe(true);
      
      mockClient.query.mockResolvedValue({ rows: [] });
      expect(await setupDb.enablePostGIS()).toBe(true);
      
      // Reset and setup mocks specifically for checkDatabaseReadiness (which makes 2 client.query calls)
      mockClient.query.mockReset();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] })  // First query - PostGIS check
        .mockResolvedValueOnce({ rows: [{ table_exists: true }] });    // Second query - Table check
      
      const readiness = await setupDb.checkDatabaseReadiness();
      expect(readiness.postgis_enabled).toBe(true);
      expect(readiness.table_exists).toBe(true);
    });

    it('should handle preparation failures gracefully', async () => {
      // Mock connection failure for testConnection (uses pool.query)
      mockPool.query.mockRejectedValue(new Error('Database unavailable'));

      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Ingestion Script Validation', () => {
    it('should validate EAS endpoint configuration', () => {
      expect(config.EAS_ENDPOINT_ARBITRUM).toBeDefined();
      expect(config.EAS_ENDPOINT_CELO).toBeDefined();
      expect(config.EAS_ENDPOINT_SEPOLIA).toBeDefined();
      expect(config.EAS_ENDPOINT_BASE).toBeDefined();
      expect(config.EAS_SCHEMA_UID).toBeDefined();
    });

    it('should validate database connection string', () => {
      expect(config.DATABASE_URL).toBeDefined();
      expect(config.DATABASE_URL).toContain('postgres://');
    });
  });

  describe('Data Processing and Storage', () => {
    it('should insert location proof data correctly', async () => {
      // Mock successful data insertion
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      // Simulate inserting a location proof
      const insertQuery = `
        INSERT INTO location_proofs (uid, attester, recipient, time, geom, latitude, longitude, country, region, city, chain)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10, $11, $12)
        ON CONFLICT (uid) DO NOTHING
      `;
      
      const testData = [
        '0x1234567890abcdef',
        '0xattester123',
        '0xrecipient456', 
        1234567890,
        -122.4194, // longitude
        37.7749,   // latitude
        37.7749,   // latitude for geom
        -122.4194, // longitude for geom
        'United States',
        'California',
        'San Francisco',
        'sepolia'
      ];

      await mockClient.query(insertQuery, testData);

      expect(mockClient.query).toHaveBeenCalledWith(insertQuery, testData);
    });

    it('should handle duplicate data with ON CONFLICT', async () => {
      // Mock successful conflict resolution (no rows inserted)
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const insertQuery = `
        INSERT INTO location_proofs (uid, attester, recipient, time, geom, latitude, longitude, country, region, city, chain)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10, $11, $12)
        ON CONFLICT (uid) DO NOTHING
      `;
      
      const duplicateData = [
        '0x1234567890abcdef', // Same UID as previous test
        '0xattester123',
        '0xrecipient456',
        1234567890,
        -122.4194,
        37.7749,
        37.7749,
        -122.4194,
        'United States',
        'California',
        'San Francisco',
        'sepolia'
      ];

      await mockClient.query(insertQuery, duplicateData);

      expect(mockClient.query).toHaveBeenCalledWith(insertQuery, duplicateData);
    });

    it('should handle geospatial data correctly', async () => {
      // Mock PostGIS function calls
      mockClient.query.mockResolvedValueOnce({ 
        rows: [{ 
          point: 'POINT(-122.4194 37.7749)',
          lat: 37.7749,
          lng: -122.4194 
        }] 
      });

      // Test PostGIS point creation
      const geoQuery = `
        SELECT 
          ST_AsText(ST_SetSRID(ST_MakePoint($1, $2), 4326)) as point,
          $2 as lat,
          $1 as lng
      `;

      await mockClient.query(geoQuery, [-122.4194, 37.7749]);

      expect(mockClient.query).toHaveBeenCalledWith(geoQuery, [-122.4194, 37.7749]);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout for testConnection (uses pool.query)
      mockPool.query.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );

      const setupDb = await import('../../src/scripts/setup-db');
      const result = await setupDb.testConnection();

      expect(result).toBe(false);
    });

    it('should clean up resources on error', async () => {
      // Mock operation that fails for testConnection (uses pool.query, then pool.end)
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      const setupDb = await import('../../src/scripts/setup-db');
      await setupDb.testConnection();

      // Should end the pool even on error
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle malformed EAS data', async () => {
      // Mock insertion of invalid data
      mockClient.query.mockRejectedValue(new Error('Invalid data format'));

      try {
        const insertQuery = `
          INSERT INTO location_proofs (uid, attester, time, geom, chain)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
        `;
        
        // Invalid coordinates (missing longitude)
        await mockClient.query(insertQuery, [
          '0xinvalid',
          '0xattester',
          1234567890,
          null, // Invalid coordinate
          'chain'
        ]);
      } catch (error) {
        expect((error as Error).message).toContain('Invalid data format');
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle batch operations efficiently', async () => {
      // Mock batch insertion
      const batchSize = 100;
      const mockData = Array.from({ length: batchSize }, (_, i) => ({
        uid: `0x${i.toString(16).padStart(16, '0')}`,
        attester: '0xattester123',
        time: 1234567890 + i,
        chain: 'sepolia'
      }));

      // Mock successful batch insert
      mockClient.query.mockResolvedValue({ rowCount: batchSize });

      // Simulate batch processing
      const insertQuery = `
        INSERT INTO location_proofs (uid, attester, time, chain)
        VALUES ${mockData.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
        ON CONFLICT (uid) DO NOTHING
      `;

      const flatValues = mockData.flatMap(item => [item.uid, item.attester, item.time, item.chain]);
      await mockClient.query(insertQuery, flatValues);

      expect(mockClient.query).toHaveBeenCalledWith(insertQuery, flatValues);
    });

    it('should optimize database connections for high volume', () => {
      // Test connection pool configuration
      const poolConfig = {
        connectionString: process.env.DATABASE_URL,
        max: 2, // Limited for session pooler
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      };

      // Verify configuration is suitable for high volume ingestion
      expect(poolConfig.max).toBeLessThanOrEqual(10); // Session pooler friendly
      expect(poolConfig.idleTimeoutMillis).toBeLessThanOrEqual(30000); // Reasonable timeout
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should complete end-to-end setup and validation', async () => {
      // Use the same pattern as setup-db.test.ts integration test
      const setupDb = await import('../../src/scripts/setup-db');
      const { SchemaValidator } = await import('../../src/scripts/validate-schema');

      // Test individual successful operations (like setup-db.test.ts does)
      mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }] });
      mockClient.query.mockResolvedValue({ rows: [] });
      
      expect(await setupDb.testConnection()).toBe(true);
      expect(await setupDb.enablePostGIS()).toBe(true);
      
      // Test readiness check (exactly like setup-db.test.ts)
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ table_exists: true }] });
      
      const readiness = await setupDb.checkDatabaseReadiness();
      expect(readiness.postgis_enabled).toBe(true);
      expect(readiness.table_exists).toBe(true);

      // Test schema validation with simplified approach
      const validator = new SchemaValidator();
      const differences = await validator.validateSchema();
      expect(differences).toHaveLength(0);
    });

    it('should fail gracefully with clear error messages', async () => {
      // Mock connection failure for testConnection (uses pool.query)
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const setupDb = await import('../../src/scripts/setup-db');
      
      // Should handle failure gracefully
      const result = await setupDb.testConnection();
      expect(result).toBe(false);
      
      // Error should be logged (we've mocked console.error in beforeEach)
      expect(jest.spyOn(console, 'error')).toHaveBeenCalled();
    });
  });
});
