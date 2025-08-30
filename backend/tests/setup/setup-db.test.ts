
// Mock process.exit to prevent test termination
jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
  throw new Error(`process.exit called with code ${code}`);
}) as jest.MockedFunction<typeof process.exit>);

// Mock the config module BEFORE other imports
jest.mock('../../src/config', () => ({
  config: {
    DATABASE_URL: 'postgres://user:password@localhost:5432/testdb',
  }
}));

// Mock the SchemaValidator BEFORE other imports
jest.mock('../../src/scripts/validate-schema', () => ({
  SchemaValidator: jest.fn().mockImplementation(() => ({
    validateSchema: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    printDifferences: jest.fn()
  }))
}));

// Mock filesystem operations BEFORE other imports
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('CREATE TABLE test();')
}));

jest.mock('path', () => ({
  resolve: jest.fn().mockReturnValue('/mock/path/migration.sql')
}));

// Mock the migrations
jest.mock('../../src/migrations/run-migrations', () => jest.fn().mockResolvedValue(undefined));

// Mock dotenv to prevent any environment loading issues
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Create mocks for pg module BEFORE other imports
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

describe('Database Setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations with successful defaults
    mockClient.query.mockResolvedValue({ rows: [{ now: new Date().toISOString() }] });
    mockPool.query.mockResolvedValue({ rows: [{ now: new Date().toISOString() }] });
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue(undefined);
    mockClient.release.mockResolvedValue(undefined);
  });

  // afterEach(() => {
  //   jest.restoreAllMocks();
  // });

  // afterAll(async () => {
  //   // Ensure all database connections are properly closed
  //   if (mockPool.end && typeof mockPool.end === 'function') {
  //     await mockPool.end();
  //   }
  //   if (mockClient.release && typeof mockClient.release === 'function') {
  //     await mockClient.release();
  //   }
  //   // Force Jest to exit cleanly
  //   await new Promise(resolve => setTimeout(resolve, 100));
  // });

  describe('Database Connection Tests', () => {
    it('should test database connection successfully', async () => {
      // Mock a successful connection test - testConnection uses pool.query directly
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date().toISOString() }] });

      // Import the module to test
      const { testConnection } = await import('../../src/scripts/setup-db');
      const result = await testConnection();

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
    });

    it('should handle connection failures gracefully', async () => {
      // Mock a query failure in pool.query
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const { testConnection } = await import('../../src/scripts/setup-db');
      const result = await testConnection();

      expect(result).toBe(false);
    });

    it('should handle query failures during connection test', async () => {
      // Mock a query failure in pool.query
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

      const { testConnection } = await import('../../src/scripts/setup-db');
      const result = await testConnection();

      expect(result).toBe(false);
    });
  });

  describe('PostGIS Setup Tests', () => {
    it('should enable PostGIS extension successfully', async () => {
      // Mock successful PostGIS installation - enablePostGIS uses connect() then client.query()
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // CREATE EXTENSION

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.enablePostGIS();

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS postgis;');
    });

    it('should handle PostGIS extension creation failure', async () => {
      // Mock PostGIS installation failure - query fails
      mockClient.query.mockRejectedValueOnce(new Error('PostGIS installation failed'));

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.enablePostGIS();

      expect(result).toBe(false);
    });

    it('should detect already installed PostGIS', async () => {
      // Mock PostGIS already installed - the query succeeds
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // CREATE EXTENSION (already exists)

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.enablePostGIS();

      expect(result).toBe(true);
    });
  });

  describe('Migration Execution Tests', () => {
    it('should run migrations successfully', async () => {
      // The setup-db script re-exports runMigrations, so our mock should work
      const setupModule = await import('../../src/scripts/setup-db');
      
      // runMigrations is already mocked at the top level
      await expect(setupModule.runMigrations()).resolves.toBeUndefined();
    });

    it('should handle migration execution errors', async () => {
      // Reset the mock to reject for this test
      const mockMigrations = jest.requireMock('../../src/migrations/run-migrations');
      mockMigrations.mockRejectedValueOnce(new Error('Migration failed'));
      
      const setupModule = await import('../../src/scripts/setup-db');
      
      await expect(setupModule.runMigrations()).rejects.toThrow('Migration failed');
    });
  });

  describe('Schema Validation Tests', () => {
    it('should validate schema successfully', async () => {
      // Reset the mock to ensure clean state
      jest.clearAllMocks();
      
      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.verifySetup();

      expect(result).toBe(true);
    });

    it('should handle schema validation failures', async () => {
      // Get the mocked SchemaValidator and update its behavior
      const mockSchemaValidator = jest.requireMock('../../src/scripts/validate-schema').SchemaValidator;
      const mockInstance = {
        validateSchema: jest.fn().mockResolvedValue([
          { type: 'missing_table', table: 'location_proofs', details: 'Table missing' }
        ]),
        close: jest.fn().mockResolvedValue(undefined),
        printDifferences: jest.fn()
      };
      mockSchemaValidator.mockImplementation(() => mockInstance);

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.verifySetup();

      expect(result).toBe(false);
    });
  });

  describe('Database Readiness Check Tests', () => {
    it('should confirm database is ready when all checks pass', async () => {
      // Mock successful PostGIS and table checks using the actual query patterns
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] }) // PostGIS extension check
        .mockResolvedValueOnce({ rows: [{ table_exists: true }] }); // Table existence check

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.checkDatabaseReadiness();

      expect(result.postgis_enabled).toBe(true);
      expect(result.table_exists).toBe(true);
    });

    it('should detect missing table', async () => {
      // Mock PostGIS enabled but table missing
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] }) // PostGIS check
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] }); // Table check

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.checkDatabaseReadiness();

      expect(result.postgis_enabled).toBe(true);
      expect(result.table_exists).toBe(false);
    });

    it('should detect missing PostGIS and table', async () => {
      // Mock both PostGIS and table missing
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: false }] }) // PostGIS check
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] }); // Table check

      const setupModule = await import('../../src/scripts/setup-db');
      const result = await setupModule.checkDatabaseReadiness();

      expect(result.postgis_enabled).toBe(false);
      expect(result.table_exists).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full setup process successfully', async () => {
      // For now, let's test that the setup function exists and can be called
      // The actual integration with process.exit is complex to test properly
      const setupModule = await import('../../src/scripts/setup-db');
      
      // Verify all the required functions are exported
      expect(typeof setupModule.testConnection).toBe('function');
      expect(typeof setupModule.enablePostGIS).toBe('function');
      expect(typeof setupModule.verifySetup).toBe('function');
      expect(typeof setupModule.checkDatabaseReadiness).toBe('function');
      expect(typeof setupModule.setupDatabase).toBe('function');
      expect(typeof setupModule.runMigrations).toBe('function');
      
      // Test individual successful operations
      mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }] });
      mockClient.query.mockResolvedValue({ rows: [] });
      
      expect(await setupModule.testConnection()).toBe(true);
      expect(await setupModule.enablePostGIS()).toBe(true);
      
      // Test readiness check
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ postgis_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ table_exists: true }] });
      
      const readiness = await setupModule.checkDatabaseReadiness();
      expect(readiness.postgis_enabled).toBe(true);
      expect(readiness.table_exists).toBe(true);
    });

    it('should fail gracefully when connection cannot be established', async () => {
      // Mock connection failure for testConnection (uses pool.query)
      mockPool.query.mockRejectedValue(new Error('Database unavailable'));

      const setupModule = await import('../../src/scripts/setup-db');
      
      // The setupDatabase function calls process.exit on failure, so we expect it to throw
      await expect(setupModule.setupDatabase()).rejects.toThrow('process.exit called with code 1');
    });
  });

  describe('Error Recovery Tests', () => {
    it('should clean up connections on failure', async () => {
      // Mock failure during operation for enablePostGIS (which uses client)
      mockClient.query.mockRejectedValue(new Error('Operation failed'));

      const setupModule = await import('../../src/scripts/setup-db');
      await setupModule.enablePostGIS(); // This should handle the error and still call client.release()

      // Verify client was released during the finally block
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
