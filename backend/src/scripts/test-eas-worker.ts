/**
 * Script to test EAS worker initialization
 */
import 'dotenv/config';
import { EasWorker } from '../workers/eas-worker';
import { logger } from '../utils/logger';
import { easService } from '../services/eas.service';

async function testEasWorker() {
  try {
    // Print environment variables that affect worker initialization
    logger.info('Testing EAS worker initialization');
    logger.info(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
    logger.info(`SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Not set'}`);
    logger.info(`SUPABASE_KEY: ${process.env.SUPABASE_KEY ? 'Set' : 'Not set'}`);
    logger.info(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set'}`);
    
    // Create a worker instance
    const worker = new EasWorker();
    
    // Try to initialize the worker
    logger.info('Initializing EAS worker...');
    await worker.initialize();
    logger.info('EAS worker initialized successfully!');
    
    // Get the stats
    const stats = worker.getStats();
    logger.info('Worker stats:', stats);
    
    // Test get GraphQL clients - use easService from our direct import
    const clients = easService.getGraphQLClients();
    logger.info(`GraphQL clients initialized for chains: ${Object.keys(clients).join(', ')}`);
    
    // Success!
    logger.info('EAS worker test completed successfully');
  } catch (error) {
    logger.error('Error testing EAS worker:', error);
  }
}

// Run the test
testEasWorker();