// Test utilities and helpers for the test suite

export interface MockDatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface TestAttestationData {
  uid: string;
  schema: string;
  attester: string;
  data: string;
  time: number;
  revocable: boolean;
  revoked: boolean;
}

export interface TestGeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id?: string;
    name?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

/**
 * Mock database client configuration
 */
export const mockDbConfig: MockDatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  user: 'test_user',
  password: 'test_password',
};

/**
 * Creates a mock EAS attestation for testing
 */
export function createMockAttestation(overrides?: Partial<TestAttestationData>): TestAttestationData {
  return {
    uid: '0x123456789abcdef',
    schema: '0x987654321fedcba',
    attester: '0xabcdef123456789',
    data: '0x1234567890abcdef',
    time: Date.now(),
    revocable: true,
    revoked: false,
    ...overrides,
  };
}

/**
 * Creates a mock GeoJSON feature for testing
 */
export function createMockGeoJsonFeature(overrides?: Partial<TestGeoJsonFeature>): TestGeoJsonFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-122.4194, 37.7749], // San Francisco
    },
    properties: {
      id: 'test-feature-1',
      name: 'Test Location',
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Creates a mock HTTP request object for testing
 */
export function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

/**
 * Creates a mock HTTP response object for testing
 */
export function createMockResponse() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Database connection mock helpers
 */
export const mockDbHelpers = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  release: jest.fn(),
};

/**
 * Common test data for spatial queries
 */
export const testSpatialData = {
  point: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  polygon: {
    type: 'Polygon',
    coordinates: [[
      [-122.5, 37.7],
      [-122.3, 37.7],
      [-122.3, 37.8],
      [-122.5, 37.8],
      [-122.5, 37.7],
    ]],
  },
  bbox: [-122.5, 37.7, -122.3, 37.8], // [minX, minY, maxX, maxY]
};

/**
 * Helper to wait for async operations in tests
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to create test database tables
 */
export function createTestTables(client: { query: (sql: string) => Promise<unknown> }) {
  return client.query(`
    CREATE TABLE IF NOT EXISTS test_locations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      geometry GEOMETRY(Point, 4326),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/**
 * Helper to clean up test database
 */
export function cleanupTestTables(client: { query: (sql: string) => Promise<unknown> }) {
  return client.query('DROP TABLE IF EXISTS test_locations;');
}
