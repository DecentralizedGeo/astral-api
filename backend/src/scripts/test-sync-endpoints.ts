/**
 * Script to test the sync API endpoints directly
 */
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

// Set the NODE_ENV to 'test' to use the mock worker
process.env.NODE_ENV = 'test';

const BASE_URL = 'http://localhost:3000/api/sync';

async function testSyncEndpoints() {
  try {
    // Test each endpoint directly without using sync controller
    logger.info('Testing sync endpoints with direct HTTP requests...');
    
    logger.info('Testing /api/sync/status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/status`);
    const statusData = await statusResponse.json();
    logger.info('Status response:', JSON.stringify(statusData, null, 2));
    
    logger.info('\nTesting worker control endpoint (status=stop)...');
    const stopResponse = await fetch(`${BASE_URL}/worker?action=stop`, {
      method: 'POST'
    });
    const stopData = await stopResponse.json();
    logger.info('Stop response:', stopData);
    
    logger.info('\nTesting worker control endpoint (status=start)...');
    const startResponse = await fetch(`${BASE_URL}/worker?action=start`, {
      method: 'POST'
    });
    const startData = await startResponse.json();
    logger.info('Start response:', startData);
    
    logger.info('\nTesting trigger revocation check endpoint...');
    const revocationResponse = await fetch(`${BASE_URL}/revocations`, {
      method: 'POST'
    });
    const revocationData = await revocationResponse.json();
    logger.info('Revocation response:', revocationData);
    
    logger.info('\nTesting trigger sync endpoint for sepolia...');
    const syncResponse = await fetch(`${BASE_URL}?chain=sepolia`, {
      method: 'POST'
    });
    const syncData = await syncResponse.json();
    logger.info('Sync response:', syncData);
    
    logger.info('\nTesting sync status again to see updated stats...');
    const finalStatusResponse = await fetch(`${BASE_URL}/status`);
    const finalStatusData = await finalStatusResponse.json();
    logger.info('Final status response:', JSON.stringify(finalStatusData, null, 2));
    
    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error('Error testing endpoints:', error);
  }
}

// Run the tests
testSyncEndpoints();