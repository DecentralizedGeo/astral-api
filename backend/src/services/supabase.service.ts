import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { LocationProof, LocationProofQueryParams } from '../models/types';
import { logger } from '../utils/logger';

/**
 * Supabase service for real-time updates, authentication, and CRUD operations
 */
class SupabaseService {
  private client: SupabaseClient | null = null;
  private readonly TABLE_NAME = 'location_proofs';

  /**
   * Initialize the Supabase client
   */
  initialize(): SupabaseClient | null {
    if (!this.client && config.SUPABASE_URL) {
      // Use service role key if available, otherwise fall back to anon key
      if (config.SUPABASE_SERVICE_ROLE_KEY) {
        logger.info('Initializing Supabase client with service role key');
        this.client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
      } else if (config.SUPABASE_KEY) {
        logger.info('Initializing Supabase client with anon key');
        this.client = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
      } else {
        logger.warn('Neither Supabase service role key nor anon key provided. Supabase features will be disabled.');
        return null;
      }
      return this.client;
    } else if (!config.SUPABASE_URL) {
      logger.warn('Supabase URL not provided. Supabase features will be disabled.');
      return null;
    }

    return this.client;
  }

  /**
   * Get the Supabase client instance
   */
  getClient(): SupabaseClient | null {
    if (!this.client) {
      return this.initialize();
    }
    return this.client;
  }
  
  /**
   * Check if Supabase client is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Create a new location proof
   * 
   * @param proof The location proof to create
   * @returns The created location proof, or null if creation failed
   */
  async createLocationProof(proof: Partial<LocationProof>): Promise<LocationProof | null> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return null;
    }
    
    try {
      const { data, error } = await client
        .from(this.TABLE_NAME)
        .insert(proof)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating location proof:', error);
        return null;
      }
      
      return data as LocationProof;
    } catch (error) {
      logger.error('Exception creating location proof:', error);
      return null;
    }
  }

  /**
   * Get a location proof by its UID
   * 
   * @param uid The UID of the location proof
   * @returns The location proof, or null if not found
   */
  async getLocationProofByUid(uid: string): Promise<LocationProof | null> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return null;
    }
    
    try {
      const { data, error } = await client
        .from(this.TABLE_NAME)
        .select('*')
        .eq('uid', uid)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        
        logger.error('Error fetching location proof:', error);
        return null;
      }
      
      return data as LocationProof;
    } catch (error) {
      logger.error('Exception fetching location proof:', error);
      return null;
    }
  }

  /**
   * Query location proofs with filters
   * 
   * @param params The query parameters
   * @returns An array of location proofs
   */
  async queryLocationProofs(params: LocationProofQueryParams = {}): Promise<LocationProof[]> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return [];
    }
    
    try {
      let query = client
        .from(this.TABLE_NAME)
        .select('*');
      
      // Apply filters
      if (params.chain) {
        query = query.eq('chain', params.chain);
      }
      
      if (params.prover) {
        query = query.eq('prover', params.prover);
      }
      
      if (params.subject) {
        query = query.eq('subject', params.subject);
      }
      
      if (params.fromTimestamp) {
        query = query.gte('event_timestamp', params.fromTimestamp.toISOString());
      }
      
      if (params.toTimestamp) {
        query = query.lte('event_timestamp', params.toTimestamp.toISOString());
      }
      
      // Apply bounding box filter if provided
      if (params.bbox) {
        const [minLon, minLat, maxLon, maxLat] = params.bbox;
        
        // Use PostgreSQL's PostGIS functions via RPC
        // The function 'location_proofs_in_bbox' is defined in SUPABASE-SETUP.md
        const { data: bboxData, error: bboxError } = await client.rpc(
          'location_proofs_in_bbox',
          { min_lng: minLon, min_lat: minLat, max_lng: maxLon, max_lat: maxLat }
        );
        
        if (bboxError) {
          logger.error('Error executing spatial query:', bboxError);
          return [];
        }
        
        // Apply other filters to the spatial query results
        const filteredResults = (bboxData as LocationProof[]).filter(proof => {
          let match = true;
          
          if (params.chain && proof.chain !== params.chain) match = false;
          if (params.prover && proof.prover !== params.prover) match = false;
          if (params.subject && proof.subject !== params.subject) match = false;
          
          if (params.fromTimestamp && new Date(proof.event_timestamp) < params.fromTimestamp) match = false;
          if (params.toTimestamp && new Date(proof.event_timestamp) > params.toTimestamp) match = false;
          
          return match;
        });
        
        // Apply pagination
        const start = params.offset || 0;
        const end = start + (params.limit || filteredResults.length);
        
        return filteredResults
          .sort((a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime())
          .slice(start, end);
      }
      
      // Apply pagination
      if (params.limit) {
        query = query.limit(params.limit);
      }
      
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
      }
      
      // Execute query
      const { data, error } = await query.order('event_timestamp', { ascending: false });
      
      if (error) {
        logger.error('Error querying location proofs:', error);
        return [];
      }
      
      return data as LocationProof[];
    } catch (error) {
      logger.error('Exception querying location proofs:', error);
      return [];
    }
  }

  /**
   * Update a location proof by its UID
   * 
   * @param uid The UID of the location proof
   * @param updates The fields to update
   * @returns The updated location proof, or null if update failed
   */
  async updateLocationProof(uid: string, updates: Partial<LocationProof>): Promise<LocationProof | null> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return null;
    }
    
    try {
      const { data, error } = await client
        .from(this.TABLE_NAME)
        .update(updates)
        .eq('uid', uid)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating location proof:', error);
        return null;
      }
      
      return data as LocationProof;
    } catch (error) {
      logger.error('Exception updating location proof:', error);
      return null;
    }
  }

  /**
   * Set the revocation status of a location proof
   * 
   * @param uid The UID of the location proof
   * @param revoked Whether the proof is revoked
   * @returns True if the update was successful, false otherwise
   */
  async setRevocationStatus(uid: string, revoked: boolean): Promise<boolean> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return false;
    }
    
    try {
      const { error } = await client
        .from(this.TABLE_NAME)
        .update({ revoked })
        .eq('uid', uid);
      
      if (error) {
        logger.error('Error setting revocation status:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Exception setting revocation status:', error);
      return false;
    }
  }

  /**
   * Batch update revocation status for multiple location proofs
   * 
   * @param uids An array of UIDs to update
   * @param revoked Whether the proofs are revoked
   * @returns The number of successfully updated proofs
   */
  async batchUpdateRevocations(uids: string[], revoked: boolean = true): Promise<number> {
    if (uids.length === 0) {
      return 0;
    }
    
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return 0;
    }
    
    try {
      const { error, count } = await client
        .from(this.TABLE_NAME)
        .update({ revoked, updated_at: new Date().toISOString() })
        .in('uid', uids);
      
      if (error) {
        logger.error('Error batch updating revocations:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Exception batch updating revocations:', error);
      return 0;
    }
  }

  /**
   * Get the latest timestamp for a specific chain
   * Used for tracking the last processed attestation
   * 
   * @param chain The chain identifier
   * @returns The latest timestamp, or null if no proofs exist for the chain
   */
  async getLatestLocationProofTimestamp(chain: string): Promise<Date | null> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return null;
    }
    
    try {
      const { data, error } = await client
        .from(this.TABLE_NAME)
        .select('timestamp')
        .eq('chain', chain)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        
        logger.error('Error fetching latest timestamp:', error);
        return null;
      }
      
      return data?.timestamp ? new Date(data.timestamp) : null;
    } catch (error) {
      logger.error('Exception fetching latest timestamp:', error);
      return null;
    }
  }

  /**
   * Check if a location proof exists by UID
   * 
   * @param uid The UID to check
   * @returns True if the proof exists, false otherwise
   */
  async locationProofExists(uid: string): Promise<boolean> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return false;
    }
    
    try {
      const { data, error } = await client
        .from(this.TABLE_NAME)
        .select('uid')
        .eq('uid', uid)
        .maybeSingle();
      
      if (error) {
        logger.error('Error checking if location proof exists:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      logger.error('Exception checking if location proof exists:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time updates for location_proofs table
   * 
   * @param event The event to subscribe to ('INSERT' | 'UPDATE' | 'DELETE' | '*')
   * @param callback The callback function to execute when an event occurs
   */
  subscribeToLocationProofs(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: (payload: any) => void) {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return null;
    }
    
    return client
      .channel('location_proofs_channel')
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table: this.TABLE_NAME,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Get a count of location proofs with optional filters
   * 
   * @param params Optional query parameters
   * @returns The count of matching location proofs
   */
  async getLocationProofsCount(params: Partial<LocationProofQueryParams> = {}): Promise<number> {
    const client = this.getClient();
    
    if (!client) {
      logger.error('Supabase client not available');
      return 0;
    }
    
    try {
      let query = client
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact', head: true });
      
      // Apply filters
      if (params.chain) {
        query = query.eq('chain', params.chain);
      }
      
      if (params.prover) {
        query = query.eq('prover', params.prover);
      }
      
      if (params.subject) {
        query = query.eq('subject', params.subject);
      }
      
      if (params.fromTimestamp) {
        query = query.gte('event_timestamp', params.fromTimestamp.toISOString());
      }
      
      if (params.toTimestamp) {
        query = query.lte('event_timestamp', params.toTimestamp.toISOString());
      }
      
      // Apply bounding box filter if provided
      if (params.bbox) {
        const [minLon, minLat, maxLon, maxLat] = params.bbox;
        
        // Use PostgreSQL's PostGIS functions via RPC
        const { data: bboxData, error: bboxError } = await client.rpc(
          'location_proofs_in_bbox',
          { min_lng: minLon, min_lat: minLat, max_lng: maxLon, max_lat: maxLat }
        );
        
        if (bboxError) {
          logger.error('Error executing spatial count query:', bboxError);
          return 0;
        }
        
        // Filter and count the results manually
        return (bboxData as LocationProof[]).filter(proof => {
          let match = true;
          
          if (params.chain && proof.chain !== params.chain) match = false;
          if (params.prover && proof.prover !== params.prover) match = false;
          if (params.subject && proof.subject !== params.subject) match = false;
          
          if (params.fromTimestamp && new Date(proof.event_timestamp) < params.fromTimestamp) match = false;
          if (params.toTimestamp && new Date(proof.event_timestamp) > params.toTimestamp) match = false;
          
          return match;
        }).length;
      }
      
      // Execute count query
      const { count, error } = await query;
      
      if (error) {
        logger.error('Error counting location proofs:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Exception counting location proofs:', error);
      return 0;
    }
  }
}

// Export a singleton instance
export const supabaseService = new SupabaseService();