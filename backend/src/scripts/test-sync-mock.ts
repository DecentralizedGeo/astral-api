/**
 * Script to test the sync implementation with mocks
 */
import { logger } from '../utils/logger';
import { EasWorker } from '../workers/eas-worker';
import { DbService } from '../services/db.service';
import { EasService } from '../services/eas.service';

// Set test mode
process.env.NODE_ENV = 'test';

// Mock classes
class MockDbService {
  async getLatestLocationProofTimestamp() {
    return new Date('2024-01-01');
  }
  
  async locationProofExists() {
    return false;
  }
  
  async createLocationProof(proof: any) {
    return proof;
  }
  
  async getActiveLocationProofs() {
    return [];
  }
  
  async batchUpdateRevocations() {
    return 0;
  }
}

class MockEasService {
  async initialize() {
    logger.info('Initialized mock EAS service');
  }
  
  getGraphQLClients() {
    return {
      arbitrum: {},
      celo: {},
      sepolia: {},
      base: {}
    };
  }
  
  async processAllChains() {
    return {
      arbitrum: 2,
      celo: 0,
      sepolia: 3,
      base: 1
    };
  }
  
  async processChain(chain: string) {
    return 5;
  }
  
  async checkRevocationStatus() {
    return [];
  }
}

// Mock implementation of the EasWorker using our mocks
class TestEasWorker extends EasWorker {
  constructor() {
    super();
    // Override with mocks
    this.dbService = new MockDbService() as any;
    this.easService = new MockEasService() as any;
  }
  
  // Override initialize to avoid actual service calls
  async initialize(): Promise<void> {
    logger.info('Initialized test worker');
  }
}

// Manual tests for each worker function
async function testWorker() {
  logger.info('Creating test worker...');
  const worker = new TestEasWorker();
  
  try {
    // Initialize
    logger.info('\nTesting worker initialization...');
    await worker.initialize();
    
    // Check stats after initialization
    logger.info('\nTesting getStats()...');
    const initialStats = worker.getStats();
    logger.info('Initial stats:', initialStats);
    
    // Test starting the worker
    logger.info('\nTesting worker.start()...');
    await worker.start();
    logger.info('Worker started');
    logger.info('Worker running:', !worker.isStopped());
    
    // Test running ingestion
    logger.info('\nTesting worker.runIngestion()...');
    await worker.runIngestion();
    
    // Check stats after ingestion
    const afterIngestionStats = worker.getStats();
    logger.info('Stats after ingestion:', afterIngestionStats);
    
    // Test manual ingestion for a chain
    logger.info('\nTesting worker.runManualIngestion()...');
    const count = await worker.runManualIngestion('sepolia');
    logger.info(`Ingested ${count} attestations from sepolia`);
    
    // Test revocation checks
    logger.info('\nTesting worker.checkRevocations()...');
    await worker.checkRevocations();
    
    // Final stats
    const finalStats = worker.getStats();
    logger.info('\nFinal worker stats:', finalStats);
    
    // Test stopping the worker
    logger.info('\nTesting worker.stop()...');
    worker.stop();
    logger.info('Worker stopped:', worker.isStopped());
    
    logger.info('\nAll tests completed successfully!');
  } catch (error) {
    logger.error('Error during worker tests:', error);
  }
}

// Run the tests
testWorker();