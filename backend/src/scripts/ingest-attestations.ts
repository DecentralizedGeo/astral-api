/**
 * Script to ingest attestations from EAS for supported chains
 * 
 * Usage:
 *   npm run ingest
 *   npm run ingest -- --chain=arbitrum (for specific chain)
 */

import { DbService } from '../services/db.service';
import { EasService } from '../services/eas.service';
import { logger } from '../utils/logger';

// Parse command line arguments
const args = process.argv.slice(2);
const chainArg = args.find(arg => arg.startsWith('--chain='));
const targetChain = chainArg ? chainArg.split('=')[1] : null;

async function run() {
  try {
    // Initialize services
    const dbService = new DbService();
    const easService = new EasService(dbService);
    
    // Initialize with last processed timestamps
    await easService.initialize();
    
    // Process attestations
    if (targetChain) {
      // Process specific chain
      logger.info(`Starting attestation ingestion for ${targetChain}`);
      const count = await easService.ingestAttestations(targetChain);
      logger.info(`Ingested ${count} attestations from ${targetChain}`);
    } else {
      // Process all chains
      logger.info('Starting attestation ingestion for all chains');
      const results = await easService.processAllChains();
      
      // Log results
      for (const [chain, count] of Object.entries(results)) {
        logger.info(`Ingested ${count} attestations from ${chain}`);
      }
      
      const totalCount = Object.values(results).reduce((sum, count) => sum + count, 0);
      logger.info(`Total ingested: ${totalCount} attestations`);
    }
    
    // Check for revocations
    logger.info('Checking for revocations');
    const revocationCount = await easService.checkRevocations();
    logger.info(`Processed ${revocationCount} revocations`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error running attestation ingestion', error);
    process.exit(1);
  }
}

// Run the script
run();