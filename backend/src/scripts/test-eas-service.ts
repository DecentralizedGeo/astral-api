#!/usr/bin/env ts-node

import { DbService } from '../services/db.service';
import { EasService } from '../services/eas.service';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting EAS service test');
  
  try {
    // Create services
    const dbService = new DbService();
    const easService = new EasService(dbService);
    
    // Initialize EAS service
    logger.info('Initializing EAS service');
    await easService.initialize();
    
    // Loop through all supported chains
    const supportedChains = ['arbitrum', 'celo', 'sepolia', 'base'];
    for (const chain of supportedChains) {
      try {
        logger.info(`Testing attestation fetching for ${chain}`);
        
        // Fetch attestations
        const attestations = await easService.fetchAttestations(chain);
        logger.info(`Found ${attestations.length} attestations on ${chain}`);
        
        // Print first attestation details if available
        if (attestations.length > 0) {
          const first = attestations[0];
          logger.info(`Sample attestation: uid=${first.uid}, location=${first.location}, prover=${first.prover}`);
          logger.info(`Coordinates: lat=${first.latitude}, lng=${first.longitude}`);
          logger.info(`Timestamp: ${first.timestamp?.toISOString()}`);
        }
        
        // Check revocations
        logger.info(`Testing revocation checking for ${chain}`);
        const revokedCount = await easService.checkRevocations();
        logger.info(`Found ${revokedCount} revoked attestations across all chains`);
      } catch (error) {
        logger.error(`Error processing chain ${chain}`, error);
      }
    }
    
    // Close database connection
    await dbService.close();
    logger.info('Test completed successfully');
  } catch (error) {
    logger.error('Test failed', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  logger.error('Uncaught error', error);
  process.exit(1);
});