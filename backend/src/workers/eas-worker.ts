/**
 * EAS worker to periodically ingest attestations from supported chains
 * with enhanced reliability, monitoring, and revocation checks
 */

import { EasService } from '../services/eas.service';
import { DbService } from '../services/db.service';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import { performance } from 'perf_hooks';

// Stats interface for tracking worker performance and health
interface WorkerStats {
  startTime: Date;
  lastSuccessfulRun: Date | null;
  lastRunDuration: number | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalAttestationsIngested: Record<string, number>;
  lastRunAttestationsIngested: Record<string, number>;
  errors: Array<{
    timestamp: Date;
    message: string;
    chain?: string;
  }>;
  revocationChecks: {
    lastRun: Date | null;
    checkedCount: number;
    revokedCount: number;
  };
  isRunning: boolean;
  isRevocationCheckRunning: boolean;
}

export class EasWorker {
  // Make properties protected for test subclassing
  protected easService: EasService;
  protected dbService: DbService;
  private interval: NodeJS.Timeout | null = null;
  private revocationInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isRevocationCheckRunning: boolean = false;
  private intervalMs: number;
  private revocationIntervalMs: number;
  private maxRetries: number;
  private retryDelay: number;
  private stats: WorkerStats;
  private maxErrorsToKeep: number = 100;
  private initialized: boolean = false;

  /**
   * Create a new EAS Worker instance
   * 
   * @param intervalMs Time between ingestion runs in milliseconds (default: 60 seconds)
   * @param revocationIntervalMs Time between revocation checks in milliseconds (default: 1 hour)
   * @param maxRetries Maximum number of retries for failed operations
   * @param retryDelay Delay in milliseconds between retries
   */
  constructor(
    intervalMs: number = 60 * 1000,
    revocationIntervalMs: number = 60 * 60 * 1000,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    // Initialize with Supabase focus
    this.dbService = new DbService();
    
    // Initialize Supabase client first to ensure it's available
    supabaseService.initialize();
    
    this.easService = new EasService(this.dbService);
    this.intervalMs = intervalMs;
    this.revocationIntervalMs = revocationIntervalMs;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    
    // Initialize stats
    this.stats = {
      startTime: new Date(),
      lastSuccessfulRun: null,
      lastRunDuration: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalAttestationsIngested: {},
      lastRunAttestationsIngested: {},
      errors: [],
      revocationChecks: {
        lastRun: null,
        checkedCount: 0,
        revokedCount: 0
      },
      isRunning: false,
      isRevocationCheckRunning: false
    };
  }
  
  /**
   * Set up fallbacks to Supabase for DB operations
   */
  private setupSupabaseFallbacks(): void {
    // 1. Fallback for getLatestLocationProofTimestamp
    const originalGetLatestTimestamp = this.dbService.getLatestLocationProofTimestamp;
    this.dbService.getLatestLocationProofTimestamp = async (chain: string) => {
      try {
        // Try DbService first
        return await originalGetLatestTimestamp.call(this.dbService, chain);
      } catch (error: any) {
        logger.warn(`DbService getLatestLocationProofTimestamp failed, falling back to Supabase: ${error.message}`);
        
        // Fall back to Supabase if available
        if (supabaseService && supabaseService.isAvailable()) {
          return await supabaseService.getLatestLocationProofTimestamp(chain);
        }
        
        // Re-throw if no fallback
        throw error;
      }
    };
    
    // 2. Fallback for locationProofExists
    const originalLocationProofExists = this.dbService.locationProofExists;
    this.dbService.locationProofExists = async (uid: string) => {
      try {
        // Try DbService first
        return await originalLocationProofExists.call(this.dbService, uid);
      } catch (error: any) {
        logger.warn(`DbService locationProofExists failed, falling back to Supabase: ${error.message}`);
        
        // Fall back to Supabase if available
        if (supabaseService && supabaseService.isAvailable()) {
          return await supabaseService.locationProofExists(uid);
        }
        
        // Re-throw if no fallback
        throw error;
      }
    };
    
    // 3. Fallback for createLocationProof
    const originalCreateLocationProof = this.dbService.createLocationProof;
    this.dbService.createLocationProof = async (proof: any) => {
      try {
        // Try DbService first
        return await originalCreateLocationProof.call(this.dbService, proof);
      } catch (error: any) {
        logger.warn(`DbService createLocationProof failed, falling back to Supabase: ${error.message}`);
        
        // Fall back to Supabase if available
        if (supabaseService && supabaseService.isAvailable()) {
          const result = await supabaseService.createLocationProof(proof);
          if (!result) {
            throw new Error('Supabase fallback failed to create location proof');
          }
          return result;
        }
        
        // Re-throw if no fallback
        throw error;
      }
    };
    
    // 4. Fallback for getActiveLocationProofs
    const originalGetActiveLocationProofs = this.dbService.getActiveLocationProofs;
    this.dbService.getActiveLocationProofs = async (chain: string, limit: number = 100) => {
      try {
        // Try DbService first
        return await originalGetActiveLocationProofs.call(this.dbService, chain, limit);
      } catch (error: any) {
        logger.warn(`DbService getActiveLocationProofs failed, falling back to Supabase: ${error.message}`);
        
        // Fall back to Supabase if available
        if (supabaseService && supabaseService.isAvailable()) {
          // Create a Supabase equivalent query
          const { data, error: supaError } = await supabaseService.getClient()!
            .from('location_proofs')
            .select('*')
            .eq('chain', chain)
            .eq('revoked', false)
            .order('timestamp', { ascending: false })
            .limit(limit);
            
          if (supaError) throw supaError;
          return data || [];
        }
        
        // Re-throw if no fallback
        throw error;
      }
    };
    
    // 5. Fallback for batchUpdateRevocations
    const originalBatchUpdateRevocations = this.dbService.batchUpdateRevocations;
    this.dbService.batchUpdateRevocations = async (uids: string[], revoked: boolean = true) => {
      try {
        // Try DbService first
        return await originalBatchUpdateRevocations.call(this.dbService, uids, revoked);
      } catch (error: any) {
        logger.warn(`DbService batchUpdateRevocations failed, falling back to Supabase: ${error.message}`);
        
        // Fall back to Supabase if available
        if (supabaseService && supabaseService.isAvailable()) {
          return await supabaseService.batchUpdateRevocations(uids, revoked);
        }
        
        // Re-throw if no fallback
        throw error;
      }
    };
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Supabase client first if available
      if (supabaseService) {
        supabaseService.initialize();
        logger.info('Supabase client initialized for EAS worker');
      }
      
      // Set up fallbacks for key methods: Use Supabase's direct table access if DbService fails
      this.setupSupabaseFallbacks();
      
      // Initialize EAS service with our enhanced dbService
      await this.easService.initialize();
      
      this.initialized = true;
      logger.info('EAS worker initialized successfully with fallback mechanisms');
    } catch (error) {
      logger.error('Failed to initialize EAS worker:', error);
      throw error;
    }
  }
  
  /**
   * Start the worker for both ingestion and revocation checks
   */
  async start(): Promise<void> {
    if (this.interval) {
      logger.warn('EAS worker is already running');
      return;
    }
    
    // Make sure initialization is complete
    await this.initialize();
    
    // Run immediately on start
    await this.runIngestion();
    
    // Schedule periodic ingestion runs
    this.interval = setInterval(async () => {
      await this.runIngestion();
    }, this.intervalMs);
    
    // Schedule periodic revocation checks
    this.revocationInterval = setInterval(async () => {
      await this.checkRevocations();
    }, this.revocationIntervalMs);
    
    logger.info(`EAS worker started with ingestion interval of ${this.intervalMs}ms and revocation check interval of ${this.revocationIntervalMs}ms`);
  }
  
  /**
   * Run a single ingestion cycle for all chains with retry logic
   */
  async runIngestion(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Previous ingestion still running, skipping');
      return;
    }
    
    this.isRunning = true;
    const startTime = performance.now();
    this.stats.totalRuns++;
    
    logger.info('Starting attestation ingestion cycle');
    
    try {
      // Reset the last run stats
      this.stats.lastRunAttestationsIngested = {};
      
      // Process all chains with retry
      const results = await this.processAllChainsWithRetry();
      
      // Update stats
      for (const [chain, count] of Object.entries(results)) {
        // Add to total
        this.stats.totalAttestationsIngested[chain] = 
          (this.stats.totalAttestationsIngested[chain] || 0) + count;
        
        // Store last run count
        this.stats.lastRunAttestationsIngested[chain] = count;
        
        // Log results
        if (count > 0) {
          logger.info(`Ingested ${count} attestations from ${chain}`);
        } else {
          logger.debug(`No new attestations from ${chain}`);
        }
      }
      
      // Mark as successful
      this.stats.lastSuccessfulRun = new Date();
      this.stats.successfulRuns++;
      
    } catch (error) {
      this.stats.failedRuns++;
      this.recordError('Ingestion cycle failed', error);
      logger.error('Error during ingestion cycle', error);
    } finally {
      const endTime = performance.now();
      this.stats.lastRunDuration = endTime - startTime;
      this.isRunning = false;
    }
  }
  
  /**
   * Process all chains with retry logic
   */
  private async processAllChainsWithRetry(): Promise<Record<string, number>> {
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.maxRetries) {
      try {
        return await this.easService.processAllChains();
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries > this.maxRetries) {
          break;
        }
        
        logger.warn(`Ingestion attempt ${retries} failed, retrying in ${this.retryDelay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    throw new Error(`Failed to process chains after ${this.maxRetries} retries: ${lastError?.message}`);
  }
  
  /**
   * Check for revocations of existing attestations
   */
  async checkRevocations(): Promise<void> {
    if (this.isRevocationCheckRunning) {
      logger.warn('Previous revocation check still running, skipping');
      return;
    }
    
    this.isRevocationCheckRunning = true;
    logger.info('Starting attestation revocation check');
    
    try {
      // Get all supported chains
      const chains = Object.keys(this.easService.getGraphQLClients());
      let totalChecked = 0;
      let totalRevoked = 0;
      
      // Check each chain
      for (const chain of chains) {
        try {
          // Get active attestations for this chain (not already revoked)
          // Use limit of 100 at a time to avoid overloading the system
          const attestations = await this.dbService.getActiveLocationProofs(chain, 100);
          
          if (attestations.length === 0) {
            logger.debug(`No active attestations to check for chain ${chain}`);
            continue;
          }
          
          logger.info(`Checking revocation status for ${attestations.length} attestations on ${chain}`);
          
          // Extract UIDs
          const uids = attestations.map(a => a.uid);
          totalChecked += uids.length;
          
          // Check revocation status on-chain
          const revokedUids = await this.easService.checkRevocationStatus(chain, uids);
          
          if (revokedUids.length > 0) {
            logger.info(`Found ${revokedUids.length} revoked attestations on ${chain}`);
            
            // Update revocation status in the database
            if (supabaseService && supabaseService.isAvailable()) {
              await supabaseService.batchUpdateRevocations(revokedUids, true);
            } else {
              // Fall back to DB service
              await this.dbService.batchUpdateRevocations(revokedUids, true);
            }
            
            totalRevoked += revokedUids.length;
          } else {
            logger.debug(`No revoked attestations found on ${chain}`);
          }
        } catch (error) {
          this.recordError(`Error checking revocations for chain ${chain}`, error, chain);
          logger.error(`Error checking revocations for chain ${chain}`, error);
        }
      }
      
      // Update stats
      this.stats.revocationChecks.lastRun = new Date();
      this.stats.revocationChecks.checkedCount += totalChecked;
      this.stats.revocationChecks.revokedCount += totalRevoked;
      
      logger.info(`Revocation check complete. Checked ${totalChecked} attestations, found ${totalRevoked} revoked`);
      
    } catch (error) {
      this.recordError('Revocation check failed', error);
      logger.error('Error during revocation check', error);
    } finally {
      this.isRevocationCheckRunning = false;
    }
  }
  
  /**
   * Record an error in the worker stats
   */
  private recordError(message: string, error: any, chain?: string): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Add to stats
    this.stats.errors.push({
      timestamp: new Date(),
      message: `${message}: ${errorMsg}`,
      chain
    });
    
    // Trim errors array if it gets too large
    if (this.stats.errors.length > this.maxErrorsToKeep) {
      this.stats.errors = this.stats.errors.slice(-this.maxErrorsToKeep);
    }
  }
  
  /**
   * Get current worker statistics
   */
  getStats(): WorkerStats {
    return {
      ...this.stats,
      // Add status information
      startTime: this.stats.startTime,
      // Add active status flags
      isRunning: this.isRunning,
      isRevocationCheckRunning: this.isRevocationCheckRunning
    };
  }
  
  /**
   * Run a manual ingestion for a specific chain
   */
  async runManualIngestion(chain: string): Promise<number> {
    logger.info(`Running manual ingestion for chain ${chain}`);
    
    try {
      return await this.easService.processChain(chain);
    } catch (error) {
      this.recordError(`Manual ingestion failed for chain ${chain}`, error, chain);
      logger.error(`Error during manual ingestion for chain ${chain}`, error);
      throw error;
    }
  }
  
  /**
   * Check if the worker is currently running an ingestion
   */
  isWorkerRunning(): boolean {
    return this.isRunning || this.isRevocationCheckRunning;
  }

  /**
   * Check if the worker is stopped (no active intervals)
   */
  isStopped(): boolean {
    return this.interval === null && this.revocationInterval === null;
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.revocationInterval) {
      clearInterval(this.revocationInterval);
      this.revocationInterval = null;
    }
    
    logger.info('EAS worker stopped');
  }
}

// Run worker if this script is executed directly
if (require.main === module) {
  // Read interval from environment or use default (1 minute)
  const intervalMs = parseInt(process.env.EAS_WORKER_INTERVAL_MS || '60000', 10);
  
  // Read revocation interval from environment or use default (1 hour)
  const revocationIntervalMs = parseInt(process.env.EAS_WORKER_REVOCATION_INTERVAL_MS || '3600000', 10);
  
  const worker = new EasWorker(intervalMs, revocationIntervalMs);
  
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