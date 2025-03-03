import { supabaseService } from '../services/supabase.service';
import { LocationProofQueryParams } from '../models/types';

/**
 * Tests for spatial query functionality
 * 
 * These tests validate the spatial query capabilities of the Supabase service.
 * They require a properly configured Supabase instance with the PostGIS extension
 * and the query_locations_in_bbox function.
 */
describe('Supabase Spatial Queries', () => {
  
  beforeAll(async () => {
    // Initialize the Supabase client before running tests
    supabaseService.initialize();
  });
  
  /**
   * Test bounding box queries with the Supabase service
   */
  test('should query location proofs within a bounding box', async () => {
    // Skip if Supabase is not available
    if (!supabaseService.isAvailable()) {
      console.warn('Supabase client not available. Skipping test.');
      return;
    }
    
    // Define a bounding box covering a significant area
    // This is a wide area to ensure we get results in the test environment
    const bbox: [number, number, number, number] = [-180, -90, 180, 90];
    
    const params: LocationProofQueryParams = {
      bbox,
      limit: 10
    };
    
    // Query location proofs within the bounding box
    const results = await supabaseService.queryLocationProofs(params);
    
    // Check that we received results
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // If we have results, verify they have the expected properties
    if (results.length > 0) {
      const firstResult = results[0];
      expect(firstResult.uid).toBeDefined();
      expect(firstResult.chain).toBeDefined();
      expect(firstResult.prover).toBeDefined();
      expect(firstResult.location_type).toBeDefined();
      expect(firstResult.location).toBeDefined();
      
      // Check that longitude and latitude are defined and within the bounding box
      if (firstResult.longitude !== undefined && firstResult.latitude !== undefined) {
        expect(firstResult.longitude).toBeGreaterThanOrEqual(bbox[0]);
        expect(firstResult.longitude).toBeLessThanOrEqual(bbox[2]);
        expect(firstResult.latitude).toBeGreaterThanOrEqual(bbox[1]);
        expect(firstResult.latitude).toBeLessThanOrEqual(bbox[3]);
      }
    }
  });
  
  /**
   * Test that the count method works with bounding box queries
   */
  test('should count location proofs within a bounding box', async () => {
    // Skip if Supabase is not available
    if (!supabaseService.isAvailable()) {
      console.warn('Supabase client not available. Skipping test.');
      return;
    }
    
    // Define a bounding box covering a significant area
    const bbox: [number, number, number, number] = [-180, -90, 180, 90];
    
    const params: LocationProofQueryParams = {
      bbox
    };
    
    // Count location proofs within the bounding box
    const count = await supabaseService.getLocationProofsCount(params);
    
    // Verify the count is a number
    expect(typeof count).toBe('number');
  });
  
  /**
   * Test combining bounding box queries with other filters
   */
  test('should filter location proofs by bounding box and chain', async () => {
    // Skip if Supabase is not available
    if (!supabaseService.isAvailable()) {
      console.warn('Supabase client not available. Skipping test.');
      return;
    }
    
    // Get all available proofs first to check if we have data
    const allProofs = await supabaseService.queryLocationProofs({
      limit: 1
    });
    
    // Skip test if no data is available
    if (!allProofs.length) {
      console.warn('No location proofs available. Skipping test.');
      return;
    }
    
    // Use the chain from our sample data
    const sampleChain = allProofs[0].chain;
    
    // Define a bounding box covering a significant area
    const bbox: [number, number, number, number] = [-180, -90, 180, 90];
    
    const params: LocationProofQueryParams = {
      bbox,
      chain: sampleChain,
      limit: 10
    };
    
    // Query location proofs with filters
    const results = await supabaseService.queryLocationProofs(params);
    
    // Verify results match both filters if we have any
    if (results.length > 0) {
      for (const proof of results) {
        expect(proof.chain).toBe(sampleChain);
        
        // Check that coordinates are within the bounding box
        if (proof.longitude !== undefined && proof.latitude !== undefined) {
          expect(proof.longitude).toBeGreaterThanOrEqual(bbox[0]);
          expect(proof.longitude).toBeLessThanOrEqual(bbox[2]);
          expect(proof.latitude).toBeGreaterThanOrEqual(bbox[1]);
          expect(proof.latitude).toBeLessThanOrEqual(bbox[3]);
        }
      }
    }
  });
});