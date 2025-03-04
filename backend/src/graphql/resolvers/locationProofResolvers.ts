import { supabaseService } from '../../services/supabase.service';
import { LocationProof } from '../../models/types';
import { 
  LocationProofGraphQL, 
  LocationProofFilter, 
  LocationProofStats,
  ChainCount
} from '../types';
import { logger } from '../../utils/logger';

/**
 * Map a database location proof to the GraphQL format
 */
function mapProofToGraphQL(proof: LocationProof): LocationProofGraphQL {
  return {
    uid: proof.uid,
    chain: proof.chain,
    prover: proof.prover,
    subject: proof.subject || null,
    timestamp: proof.timestamp ? new Date(proof.timestamp).toISOString() : null,
    eventTimestamp: new Date(proof.event_timestamp).toISOString(),
    srs: proof.srs || null,
    locationType: proof.location_type || '',
    location: proof.location || '',
    longitude: proof.longitude || null,
    latitude: proof.latitude || null,
    geometry: proof.geometry || null,
    recipeTypes: proof.recipe_types || null,
    recipePayloads: proof.recipe_payloads || null,
    mediaTypes: proof.media_types || null,
    mediaData: proof.media_data || null,
    memo: proof.memo || null,
    revoked: proof.revoked || false,
    createdAt: proof.created_at ? new Date(proof.created_at).toISOString() : new Date().toISOString(),
    updatedAt: proof.updated_at ? new Date(proof.updated_at).toISOString() : new Date().toISOString()
  };
}

/**
 * Convert a GraphQL filter to the format expected by the Supabase service
 */
function mapFilterToSupabase(filter: LocationProofFilter = {}) {
  return {
    chain: filter.chain,
    prover: filter.prover,
    subject: filter.subject,
    fromTimestamp: filter.fromTimestamp ? new Date(filter.fromTimestamp) : undefined,
    toTimestamp: filter.toTimestamp ? new Date(filter.toTimestamp) : undefined,
    bbox: filter.bbox,
    limit: filter.limit || 10,
    offset: filter.offset || 0
  };
}

/**
 * Location proof resolvers
 */
export const locationProofResolvers = {
  Query: {
    /**
     * Get a single location proof by UID
     */
    locationProof: async (_: any, { uid }: { uid: string }) => {
      try {
        const proof = await supabaseService.getLocationProofByUid(uid);
        if (!proof) return null;
        
        return mapProofToGraphQL(proof);
      } catch (error) {
        logger.error('GraphQL error in locationProof resolver:', error);
        throw new Error(`Failed to retrieve location proof with UID ${uid}`);
      }
    },
    
    /**
     * Get multiple location proofs with optional filtering
     */
    locationProofs: async (_: any, { filter }: { filter?: LocationProofFilter }) => {
      try {
        const supabaseFilter = mapFilterToSupabase(filter);
        const proofs = await supabaseService.queryLocationProofs(supabaseFilter);
        
        return proofs.map(mapProofToGraphQL);
      } catch (error) {
        logger.error('GraphQL error in locationProofs resolver:', error);
        throw new Error('Failed to retrieve location proofs');
      }
    },
    
    /**
     * Get the number of location proofs matching a filter
     */
    locationProofsCount: async (_: any, { filter }: { filter?: LocationProofFilter }) => {
      try {
        const supabaseFilter = mapFilterToSupabase(filter);
        return supabaseService.getLocationProofsCount(supabaseFilter);
      } catch (error) {
        logger.error('GraphQL error in locationProofsCount resolver:', error);
        throw new Error('Failed to count location proofs');
      }
    },
    
    /**
     * Get statistics about location proofs
     */
    locationProofsStats: async () => {
      try {
        // Get total count across all chains
        const total = await supabaseService.getLocationProofsCount({});
        
        // Get count by chain
        const client = supabaseService.getClient();
        if (!client) {
          throw new Error('Supabase client not available');
        }
        
        const { data, error } = await client
          .from('location_proofs')
          .select('chain')
          .csv();
          
        if (error) throw error;
        
        // Count occurrences of each chain
        const chainCounts: Record<string, number> = {};
        
        // Parse CSV (without headers) and count chains
        const rows = data.split('\\n');
        rows.slice(1).forEach(row => {
          if (!row) return; // Skip empty rows
          const chain = row.trim();
          chainCounts[chain] = (chainCounts[chain] || 0) + 1;
        });
        
        // Convert to array of ChainCount objects
        const byChain: ChainCount[] = Object.entries(chainCounts).map(([chain, count]) => ({
          chain,
          count
        }));
        
        return {
          total,
          byChain
        };
      } catch (error) {
        logger.error('GraphQL error in locationProofsStats resolver:', error);
        throw new Error('Failed to retrieve location proof statistics');
      }
    }
  }
  
  // Mutations have been intentionally removed to make the API read-only
};