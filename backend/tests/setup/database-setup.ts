// Database test setup helpers

import { mockDbConfig } from './test-utils';

/**
 * Mock database pool for testing
 */
export class MockPool {
  private clients: MockClient[] = [];

  connect(): MockClient {
    const client = new MockClient();
    this.clients.push(client);
    return client;
  }

  end(): Promise<void> {
    this.clients.forEach(client => client.release());
    this.clients = [];
    return Promise.resolve();
  }

  query(_text: string, _params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    return Promise.resolve({ rows: [], rowCount: 0 });
  }
}

/**
 * Mock database client for testing
 */
export class MockClient {
  query(text: string, _params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    // Mock responses based on query type
    if (text.includes('SELECT version()')) {
      return Promise.resolve({
        rows: [{ version: 'PostgreSQL 14.0 (Test)' }],
        rowCount: 1,
      });
    }

    if (text.includes('CREATE EXTENSION')) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    if (text.includes('SELECT * FROM spatial_ref_sys')) {
      return Promise.resolve({
        rows: [{ srid: 4326, auth_name: 'EPSG', auth_srid: 4326 }],
        rowCount: 1,
      });
    }

    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  release(): void {
    // No-op for mock
  }

  end(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Setup mock for pg module
 */
export function setupDatabaseMocks() {
  jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => new MockPool()),
    Client: jest.fn().mockImplementation(() => new MockClient()),
  }));
}

/**
 * Get mock database configuration for tests
 */
export function getTestDatabaseConfig() {
  return mockDbConfig;
}

/**
 * Create a mock database pool for testing
 */
export function createMockPool(): MockPool {
  return new MockPool();
}

/**
 * Create a mock database client for testing
 */
export function createMockClient(): MockClient {
  return new MockClient();
}
