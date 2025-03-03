#!/usr/bin/env node

import dotenv from 'dotenv';
import { easService } from '../services/eas.service';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';
import { easEndpoints } from '../config';

// Load environment variables
dotenv.config();

// Initialize services
supabaseService.initialize();

/**
 * Sync historical attestations for a specific chain
 * 
 * @param chain The chain to sync attestations for
 * @param batchSize The number of attestations to fetch per batch
 * @param startFromScratch Whether to start from scratch or resume from the latest attestation
 * @returns The number of attestations synced
 */
async function syncHistoricalAttestations(
  chain: string,
  batchSize: number = 100,
  startFromScratch: boolean = false
): Promise<number> {
  logger.info(`Starting historical attestation sync for chain: ${chain}`);
  
  let totalProcessed = 0;
  let lastTimestamp = startFromScratch ? null : await supabaseService.getLatestLocationProofTimestamp(chain);
  
  if (lastTimestamp) {
    logger.info(`Resuming from timestamp: ${lastTimestamp.toISOString()}`);
  } else {
    logger.info('Starting from the beginning');
  }
  
  let moreAvailable = true;
  
  while (moreAvailable) {
    try {
      // Fetch attestations
      const attestations = await easService.fetchAttestations(chain, batchSize, lastTimestamp ? lastTimestamp.toISOString() : undefined);
      
      if (attestations.length === 0) {
        logger.info('No more attestations available');
        moreAvailable = false;
        break;
      }
      
      logger.info(`Fetched ${attestations.length} attestations`);
      
      // Process attestations
      for (const attestation of attestations) {
        try {
          const proofExists = await supabaseService.locationProofExists(attestation.id);
          
          if (!proofExists) {
            const locationProof = await easService.convertAttestationToLocationProof(attestation, chain);
            await supabaseService.createLocationProof(locationProof);
            logger.debug(`Inserted attestation with UID: ${attestation.id}`);
          } else {
            logger.debug(`Attestation with UID: ${attestation.id} already exists, skipping`);
          }
        } catch (error) {
          logger.error(`Error processing attestation with UID: ${attestation.id}:`, error);
          // Continue processing other attestations
        }
      }
      
      // Update timestamp for next batch
      if (attestations.length > 0) {
        const lastAttestationTimestamp = new Date(attestations[attestations.length - 1].timeCreated);
        // Add 1 millisecond to avoid duplicate attestations
        lastAttestationTimestamp.setMilliseconds(lastAttestationTimestamp.getMilliseconds() + 1);
        lastTimestamp = lastAttestationTimestamp;
      }
      
      totalProcessed += attestations.length;
      logger.info(`Processed ${totalProcessed} attestations so far`);
      
      // Check if we got fewer attestations than the batch size
      if (attestations.length < batchSize) {
        moreAvailable = false;
      }
    } catch (error) {
      logger.error(`Error syncing historical attestations for chain ${chain}:`, error);
      throw error;
    }
  }
  
  logger.info(`Completed historical attestation sync for chain: ${chain}. Total processed: ${totalProcessed}`);
  return totalProcessed;
}

/**
 * Main function to sync all chains
 */
async function main() {
  const args = process.argv.slice(2);
  const chain = args[0];
  const batchSize = args[1] ? parseInt(args[1], 10) : 100;
  const startFromScratch = args[2] === '--start-from-scratch';
  
  try {
    if (chain && chain !== 'all') {
      // Sync a specific chain
      if (!easEndpoints[chain as keyof typeof easEndpoints]) {
        logger.error(`Unsupported chain: ${chain}`);
        process.exit(1);
      }
      
      await syncHistoricalAttestations(chain, batchSize, startFromScratch);
    } else {
      // Sync all chains
      const chains = Object.keys(easEndpoints).filter(
        c => !!easEndpoints[c as keyof typeof easEndpoints]
      );
      
      let totalProcessed = 0;
      
      for (const c of chains) {
        try {
          const processed = await syncHistoricalAttestations(c, batchSize, startFromScratch);
          totalProcessed += processed;
        } catch (error) {
          logger.error(`Failed to sync chain ${c}:`, error);
          // Continue with other chains
        }
      }
      
      logger.info(`Completed syncing all chains. Total processed: ${totalProcessed}`);
    }
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
}).finally(() => {
  // Cleanup resources
  process.exit(0);
});