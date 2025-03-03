/**
 * Debug EasWorker initialization issue
 */
import 'dotenv/config';
import { DbService } from '../services/db.service';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';
import { EasService } from '../services/eas.service';

async function debugWorkerInit() {
  try {
    // 1. Initialize Supabase (which is working)
    logger.info('Initializing Supabase...');
    supabaseService.initialize();
    logger.info('Supabase initialized successfully');
    
    // 2. Initialize DbService
    logger.info('Initializing DbService...');
    const dbService = new DbService();
    
    // Test direct table access with DbService
    try {
      logger.info('Testing getLatestLocationProofTimestamp with DbService...');
      const latestTimestamp = await dbService.getLatestLocationProofTimestamp('sepolia');
      logger.info('Latest timestamp from DbService:', latestTimestamp);
    } catch (error) {
      logger.error('Error getting latest timestamp with DbService:', error);
    }
    
    // 3. Initialize EasService
    logger.info('Initializing EasService...');
    const easService = new EasService(dbService);
    
    // 4. Initialize EasService timestamps (the part that's failing)
    logger.info('Initializing EasService timestamps...');
    try {
      await easService.initialize();
      logger.info('EasService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EasService timestamps:', error);
    }
    
    logger.info('Debug completed');
  } catch (error) {
    logger.error('Unexpected error during debug:', error);
  }
}

// Run debug
debugWorkerInit();