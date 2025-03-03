import { supabaseService } from '../services/supabase.service';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  try {
    // Initialize Supabase client
    const client = supabaseService.initialize();
    
    if (!client) {
      console.error('Failed to initialize Supabase client');
      return;
    }
    
    console.log('Supabase client initialized successfully!');
    
    // Try to query location proofs
    const { data, error } = await client
      .from('location_proofs')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error querying location proofs:', error);
      return;
    }
    
    console.log(`Successfully queried ${data.length} location proofs`);
    
    if (data.length > 0) {
      console.log('Sample location proof:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No location proofs found in the database');
    }
    
    // Try to count location proofs by chain
    const chains = ['arbitrum', 'celo', 'sepolia', 'base'];
    console.log('\nCounts by chain:');
    
    for (const chain of chains) {
      const { count, error } = await client
        .from('location_proofs')
        .select('*', { count: 'exact', head: true })
        .eq('chain', chain);
        
      if (error) {
        console.error(`Error counting location proofs for ${chain}:`, error);
        continue;
      }
      
      console.log(`- ${chain}: ${count || 0} proofs`);
    }
  } catch (error: any) {
    console.error('Unexpected error:', error.message);
  }
}

testSupabase();