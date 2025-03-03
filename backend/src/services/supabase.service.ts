import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Supabase service for real-time updates and authentication
 */
class SupabaseService {
  private client: SupabaseClient | null = null;

  /**
   * Initialize the Supabase client
   */
  initialize(): SupabaseClient {
    if (!this.client && config.SUPABASE_URL && config.SUPABASE_KEY) {
      this.client = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
    } else if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
      console.warn('Supabase URL or key not provided. Supabase features will be disabled.');
    }

    if (!this.client) {
      throw new Error('Supabase client could not be initialized');
    }

    return this.client;
  }

  /**
   * Get the Supabase client instance
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      return this.initialize();
    }
    return this.client;
  }

  /**
   * Subscribe to real-time updates for location_proofs table
   * 
   * @param event The event to subscribe to ('INSERT' | 'UPDATE' | 'DELETE' | '*')
   * @param callback The callback function to execute when an event occurs
   */
  subscribeToLocationProofs(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: (payload: any) => void) {
    const client = this.getClient();
    
    return client
      .channel('location_proofs_channel')
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table: 'location_proofs',
        },
        callback
      )
      .subscribe();
  }
}

// Export a singleton instance
export const supabaseService = new SupabaseService();