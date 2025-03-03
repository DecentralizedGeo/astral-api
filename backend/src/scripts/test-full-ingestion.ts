#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import { DbService } from '../services/db.service';
import { EasService } from '../services/eas.service';
import { logger } from '../utils/logger';

// Load environment variables first - this MUST be before other imports
dotenv.config({ path: '.env.development' });

// Print loaded EAS variables for debugging
const easEnvVars = Object.keys(process.env)
  .filter(k => k.startsWith('EAS_'))
  .reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
  }, {} as Record<string, string | undefined>);

logger.info('EAS environment variables:', { variables: easEnvVars });

async function main() {
  logger.info('Starting full EAS attestation ingestion test...');
  
  // Create instances of services
  const dbService = new DbService();
  const easService = new EasService(dbService);
  
  try {
    // Initialize EAS service
    logger.info('Initializing EAS service...');
    await easService.initialize();
    
    // Process all chains
    logger.info('Starting attestation ingestion for all chains...');
    const results = await easService.processAllChains();
    
    // Log results
    logger.info('Ingestion results by chain:');
    for (const [chain, count] of Object.entries(results)) {
      logger.info(`  - ${chain}: ${count} attestations ingested`);
    }
    
    // Check for revocations using the proper method
    logger.info('Testing revocation status checking...');
    const testChain = Object.keys(easService.getGraphQLClients())[0]; // Get first available chain
    if (testChain) {
      logger.info(`Checking revocation status for chain ${testChain} using test UIDs`);
      const testUids = ['0x1234567890123456789012345678901234567890123456789012345678901234'];
      await easService.checkRevocationStatus(testChain, testUids);
    } else {
      logger.warn('No chains available for revocation checking');
    }
    
    // Query the database to verify the results
    logger.info('Querying database to verify stored attestations...');
    const proofs = await dbService.queryLocationProofs({ limit: 10 });
    
    if (proofs.length === 0) {
      logger.warn('No attestations found in database!');
    } else {
      logger.info(`Found ${proofs.length} attestations in database:`);
      
      // Display first 5 attestations
      proofs.slice(0, 5).forEach((proof, index) => {
        logger.info(`Attestation #${index + 1}:`);
        logger.info(`  ID: ${proof.uid}`);
        logger.info(`  Chain: ${proof.chain}`);
        logger.info(`  Prover: ${proof.prover}`);
        logger.info(`  Time: ${proof.timestamp?.toISOString()}`);
        logger.info(`  Location: ${proof.location}`);
        logger.info(`  Coordinates: [${proof.longitude}, ${proof.latitude}]`);
      });
    }
    
    // Close database connection
    await dbService.close();
    logger.info('Test completed successfully!');
  } catch (error) {
    logger.error('Error during attestation ingestion test:', error);
    await dbService.close();
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logger.error('Uncaught error:', error);
  process.exit(1);
});