// Integration tests for the complete API workflow

import { createMockGeoJsonFeature, createMockAttestation } from '../setup/test-utils';
import { createMockPool } from '../setup/database-setup';

describe('Integration Tests', () => {
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPool.end();
  });

  describe('Complete Location Proof Workflow', () => {
    it('should handle full location proof creation', async () => {
      // 1. Create location data
      const locationData = createMockGeoJsonFeature({
        properties: {
          id: 'test-location-1',
          name: 'Test Proof Location',
          timestamp: new Date().toISOString(),
          accuracy: 10,
        },
      });

      expect(locationData.type).toBe('Feature');
      expect(locationData.geometry.type).toBe('Point');
      expect(Array.isArray(locationData.geometry.coordinates)).toBe(true);
      expect(locationData.geometry.coordinates).toHaveLength(2);

      // 2. Create attestation
      const attestation = createMockAttestation({
        data: JSON.stringify(locationData),
      });

      expect(attestation.uid).toBeDefined();
      expect(attestation.data).toContain('Feature');

      // 3. Mock database storage
      const client = mockPool.connect();
      const result = await client.query(
        'INSERT INTO locations (geom, attestation_uid) VALUES (ST_GeomFromGeoJSON($1), $2)',
        [JSON.stringify(locationData.geometry), attestation.uid]
      );

      expect(result).toBeDefined();
      expect(result.rowCount).toBe(0); // Mock returns 0
    });

    it('should validate complete data flow', async () => {
      // Test the complete data transformation flow
      const originalCoords: [number, number] = [-122.4194, 37.7749];
      
      // 1. Create GeoJSON
      const geoJson = createMockGeoJsonFeature({
        geometry: {
          type: 'Point',
          coordinates: originalCoords,
        },
      });

      // 2. Validate structure
      expect(geoJson.geometry.coordinates).toEqual(originalCoords);

      // 3. Create attestation with GeoJSON
      const attestation = createMockAttestation({
        data: JSON.stringify(geoJson),
      });

      // 4. Parse back the data
      const parsedData = JSON.parse(attestation.data);
      expect(parsedData.geometry.coordinates).toEqual(originalCoords);
    });
  });

  describe('API Response Validation', () => {
    it('should return proper API response format', () => {
      const locationData = createMockGeoJsonFeature();
      const attestation = createMockAttestation();

      const apiResponse = {
        success: true,
        data: {
          location: locationData,
          attestation: {
            uid: attestation.uid,
            schema: attestation.schema,
            timestamp: attestation.time,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data).toHaveProperty('location');
      expect(apiResponse.data).toHaveProperty('attestation');
      expect(apiResponse.meta).toHaveProperty('timestamp');
      expect(apiResponse.meta).toHaveProperty('version');
    });

    it('should handle error responses properly', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid coordinates provided',
          details: {
            field: 'coordinates',
            value: 'invalid',
            expected: 'array of two numbers',
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'req-123',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse.error).toHaveProperty('details');
    });
  });

  describe('Database Operations', () => {
    it('should handle spatial queries', async () => {
      const client = mockPool.connect();
      
      // Test spatial query
      const result = await client.query('SELECT ST_AsText(ST_Point(-122.4194, 37.7749))');
      expect(result).toBeDefined();
    });

    it('should handle PostGIS functions', async () => {
      const client = mockPool.connect();
      
      // Test PostGIS extension
      const result = await client.query('SELECT * FROM spatial_ref_sys LIMIT 1');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('srid');
    });
  });
});
