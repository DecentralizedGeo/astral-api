// Jest setup file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://user:password@localhost:5432/testdb';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  
  Object.assign(global.console, mockConsole);
}

// Global cleanup to prevent Jest hanging
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Small delay to allow cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Increase timeout for async operations
jest.setTimeout(30000);
