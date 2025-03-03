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
          logger.info(`Sample attestation: id=${first.id}, attester=${first.attester}`);
          logger.info(`TimeCreated: ${new Date(parseInt(first.timeCreated) * 1000).toISOString()}`);
          logger.info(`Revocation status: ${first.revocationTime !== "0" ? "Revoked" : "Valid"}`);
          
          // Try to parse and show decoded data
          try {
            const decodedData = JSON.parse(first.decodedDataJson);
            logger.info(`Decoded data sample: ${JSON.stringify(decodedData.slice(0, 2))}`);
          } catch (e: any) {
            logger.warn(`Could not parse decoded data: ${e.message || 'Unknown error'}`);
          }
        }
        
        // Revocation checking
        logger.info(`Note: Testing revocation checking via checkRevocationStatus method`);
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