/**
 * Test database connection directly with Supabase
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';

async function testSupabaseConnection() {
  try {
    logger.info('Testing Supabase connection directly...');
    
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Missing Supabase credentials in environment');
      return;
    }
    
    logger.info(`SUPABASE_URL: ${config.SUPABASE_URL}`);
    logger.info(`SUPABASE_SERVICE_ROLE_KEY: ${config.SUPABASE_SERVICE_ROLE_KEY ? '[Set]' : '[Not set]'}`);
    
    // Create Supabase client
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Check if we can connect
    logger.info('Checking connection to Supabase...');
    const { data: healthCheck, error: healthError } = await supabase.rpc('get_service_role', {});
    
    if (healthError) {
      logger.error('Error checking Supabase health:', healthError);
    } else {
      logger.info('Supabase connection successful:', healthCheck);
    }
    
    // 2. Check if the location_proofs table exists
    logger.info('Checking for location_proofs table...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('location_proofs')
      .select('count(*)', { count: 'exact', head: true });
    
    if (tableError) {
      logger.error('Error accessing location_proofs table:', tableError);
    } else {
      logger.info('Successfully accessed location_proofs table. Count:', tableInfo);
    }
    
    // 3. List some records
    logger.info('Fetching a few records from location_proofs...');
    const { data: records, error: recordsError } = await supabase
      .from('location_proofs')
      .select('uid, chain, created_at')
      .limit(3);
    
    if (recordsError) {
      logger.error('Error fetching records from location_proofs:', recordsError);
    } else if (records && records.length > 0) {
      logger.info('Successfully fetched records from location_proofs:', records);
    } else {
      logger.info('No records found in location_proofs table');
    }
    
    // 4. Check the latest timestamp
    logger.info('Getting latest timestamp for sepolia chain...');
    const { data: latestTimestamp, error: timestampError } = await supabase
      .from('location_proofs')
      .select('timestamp')
      .eq('chain', 'sepolia')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (timestampError) {
      logger.error('Error getting latest timestamp for sepolia:', timestampError);
    } else {
      logger.info('Latest timestamp for sepolia:', latestTimestamp);
    }
    
    logger.info('Supabase connection tests completed');
  } catch (error) {
    logger.error('Unexpected error testing Supabase connection:', error);
  }
}

// Run the tests
testSupabaseConnection();