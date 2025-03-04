/**
 * A simple script to check if the server is running
 */
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

// Try to reach the server's health endpoint
async function checkServer() {
  try {
    logger.info('Checking server health endpoint...');
    const response = await fetch('http://localhost:3000/health');
    
    if (response.ok) {
      const data = await response.json();
      logger.info('Server is running! Response:', data);
      return true;
    } else {
      logger.error(`Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error('Error connecting to server:', error);
    return false;
  }
}

checkServer();