/**
 * EAS worker to periodically ingest attestations from supported chains
 */

import { EasService } from '../services/eas.service';
import { DbService } from '../services/db.service';
import { logger } from '../utils/logger';
import { config } from '../config';

export class EasWorker {
  private easService: EasService;
  private interval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMs: number;
  
  constructor(intervalMs: number = 5 * 60 * 1000) { // Default 5 minutes
    const dbService = new DbService();
    this.easService = new EasService(dbService);
    this.intervalMs = intervalMs;
  }
  
  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.interval) {
      logger.warn('EAS worker is already running');
      return;
    }
    
    // Initialize EAS service
    await this.easService.initialize();
    
    // Run immediately on start
    await this.runIngestion();
    
    // Schedule periodic runs
    this.interval = setInterval(async () => {
      await this.runIngestion();
    }, this.intervalMs);
    
    logger.info(`EAS worker started with interval of ${this.intervalMs}ms`);
  }
  
  /**
   * Run a single ingestion cycle for all chains
   */
  async runIngestion(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Previous ingestion still running, skipping');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting attestation ingestion cycle');
    
    try {
      // Process all chains
      const results = await this.easService.processAllChains();
      
      // Log results
      for (const [chain, count] of Object.entries(results)) {
        if (count > 0) {
          logger.info(`Ingested ${count} attestations from ${chain}`);
        } else {
          logger.debug(`No new attestations from ${chain}`);
        }
      }
      
      // Check for revocations (if implemented)
      await this.easService.checkRevocations();
      
    } catch (error) {
      logger.error('Error during ingestion cycle', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Stop the worker
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('EAS worker stopped');
    }
  }
}

// Run worker if this script is executed directly
if (require.main === module) {
  const worker = new EasWorker();
  
  // Handle shutdown signals
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down EAS worker');
    worker.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down EAS worker');
    worker.stop();
    process.exit(0);
  });
  
  // Start the worker
  worker.start().catch(error => {
    logger.error('Failed to start EAS worker', error);
    process.exit(1);
  });
}