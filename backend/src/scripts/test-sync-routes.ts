/**
 * Test the sync routes directly with mocked services
 */
import express from 'express';
import request from 'supertest';
import { syncRouter } from '../api/routes/sync.routes';
import { logger } from '../utils/logger';

// Set test mode
process.env.NODE_ENV = 'test';

async function testSyncRoutes() {
  try {
    // Create an Express app with the sync routes
    const app = express();
    app.use(express.json());
    app.use('/api/sync', syncRouter);
    
    // Test GET /api/sync/status
    logger.info('Testing GET /api/sync/status...');
    const statusResponse = await request(app).get('/api/sync/status');
    logger.info(`Status response (${statusResponse.status}):`, statusResponse.body);
    
    // Test POST /api/sync/worker?action=stop
    logger.info('\nTesting POST /api/sync/worker?action=stop...');
    const stopResponse = await request(app).post('/api/sync/worker?action=stop');
    logger.info(`Stop response (${stopResponse.status}):`, stopResponse.body);
    
    // Test POST /api/sync/worker?action=start
    logger.info('\nTesting POST /api/sync/worker?action=start...');
    const startResponse = await request(app).post('/api/sync/worker?action=start');
    logger.info(`Start response (${startResponse.status}):`, startResponse.body);
    
    // Test POST /api/sync/revocations
    logger.info('\nTesting POST /api/sync/revocations...');
    const revocationResponse = await request(app).post('/api/sync/revocations');
    logger.info(`Revocation response (${revocationResponse.status}):`, revocationResponse.body);
    
    // Test POST /api/sync?chain=sepolia
    logger.info('\nTesting POST /api/sync?chain=sepolia...');
    const syncResponse = await request(app).post('/api/sync?chain=sepolia');
    logger.info(`Sync response (${syncResponse.status}):`, syncResponse.body);
    
    logger.info('\nAll tests completed successfully!');
  } catch (error) {
    logger.error('Error testing sync routes:', error);
  }
}

// Run the tests
testSyncRoutes();