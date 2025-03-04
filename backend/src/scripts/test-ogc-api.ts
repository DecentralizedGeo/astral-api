/**
 * Test script for the OGC API Features implementation
 * This tests all the OGC API endpoints to verify they work correctly
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Set base URL for tests
const baseUrl = 'http://localhost:3000';

// Allow time for server to start
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main test function
 */
async function testOgcApi() {
  try {
    logger.info('Testing OGC API Features implementation...');
    
    // First test the root endpoint to make sure the server is running
    logger.info('\nTesting server connection with root endpoint...');
    logger.info(`Fetching URL: ${baseUrl}`);
    try {
      const rootResponse = await fetch(baseUrl);
      logger.info(`Root endpoint response status: ${rootResponse.status}`);
      if (rootResponse.ok) {
        logger.info('Server is running and responding to requests');
      } else {
        throw new Error(`Root endpoint failed with status ${rootResponse.status}`);
      }
    } catch (error) {
      logger.error('Server connection error:', error);
      throw new Error('Cannot connect to server. Make sure it is running on port 3000');
    }
    
    // Test OGC landing page
    logger.info('\n1. Testing OGC landing page...');
    logger.info(`Fetching URL: ${baseUrl}/api/ogc`);
    let landingResponse;
    try {
      landingResponse = await fetch(`${baseUrl}/api/ogc`);
      logger.info(`Response status: ${landingResponse.status}`);
      if (!landingResponse.ok) {
        throw new Error(`Landing page failed with status ${landingResponse.status}`);
      }
    } catch (error) {
      logger.error('Fetch error:', error);
      throw error;
    }
    const landingData = await landingResponse.json();
    logger.info('Landing page response successful');
    logger.info('Title:', landingData.title);
    logger.info('Links:', landingData.links.length);
    
    // Test conformance
    logger.info('\n2. Testing conformance endpoint...');
    const conformanceResponse = await fetch(`${baseUrl}/api/ogc/conformance`);
    if (!conformanceResponse.ok) {
      throw new Error(`Conformance endpoint failed with status ${conformanceResponse.status}`);
    }
    const conformanceData = await conformanceResponse.json();
    logger.info('Conformance endpoint response successful');
    logger.info('Conformance classes:', conformanceData.conformsTo);
    
    // Test collections
    logger.info('\n3. Testing collections endpoint...');
    const collectionsResponse = await fetch(`${baseUrl}/api/ogc/collections`);
    if (!collectionsResponse.ok) {
      throw new Error(`Collections endpoint failed with status ${collectionsResponse.status}`);
    }
    const collectionsData = await collectionsResponse.json();
    logger.info('Collections endpoint response successful');
    logger.info('Number of collections:', collectionsData.collections.length);
    
    // Test single collection
    const collectionId = 'location-proofs';
    logger.info(`\n4. Testing collection details for '${collectionId}'...`);
    const collectionResponse = await fetch(`${baseUrl}/api/ogc/collections/${collectionId}`);
    if (!collectionResponse.ok) {
      throw new Error(`Collection details failed with status ${collectionResponse.status}`);
    }
    const collectionData = await collectionResponse.json();
    logger.info('Collection details response successful');
    logger.info('Collection ID:', collectionData.id);
    logger.info('Collection title:', collectionData.title);
    
    // Test features
    logger.info(`\n5. Testing features endpoint for collection '${collectionId}'...`);
    const featuresResponse = await fetch(`${baseUrl}/api/ogc/collections/${collectionId}/items?limit=5`);
    if (!featuresResponse.ok) {
      throw new Error(`Features endpoint failed with status ${featuresResponse.status}`);
    }
    const featuresData = await featuresResponse.json();
    logger.info('Features endpoint response successful');
    logger.info('Number of features returned:', featuresData.features.length);
    logger.info('Number matched:', featuresData.numberMatched);
    logger.info('Content type:', featuresResponse.headers.get('content-type'));
    
    // Test a specific feature if available
    if (featuresData.features.length > 0) {
      const featureId = featuresData.features[0].id;
      logger.info(`\n6. Testing single feature endpoint for feature '${featureId}'...`);
      const featureResponse = await fetch(`${baseUrl}/api/ogc/collections/${collectionId}/items/${featureId}`);
      if (!featureResponse.ok) {
        throw new Error(`Single feature endpoint failed with status ${featureResponse.status}`);
      }
      const featureData = await featureResponse.json();
      logger.info('Single feature endpoint response successful');
      logger.info('Feature ID:', featureData.id);
      logger.info('Feature geometry type:', featureData.geometry?.type);
      logger.info('Content type:', featureResponse.headers.get('content-type'));
    }
    
    // Test bbox parameter
    logger.info('\n7. Testing bbox parameter...');
    const bboxResponse = await fetch(`${baseUrl}/api/ogc/collections/${collectionId}/items?bbox=-180,-90,180,90&limit=5`);
    if (!bboxResponse.ok) {
      throw new Error(`Bbox query failed with status ${bboxResponse.status}`);
    }
    const bboxData = await bboxResponse.json();
    logger.info('Bbox query successful');
    logger.info('Number of features returned:', bboxData.features.length);
    
    // Test datetime parameter with a range
    logger.info('\n8. Testing datetime parameter...');
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    const dateTimeQuery = `${oneYearAgo.toISOString()}/${now.toISOString()}`;
    const datetimeResponse = await fetch(`${baseUrl}/api/ogc/collections/${collectionId}/items?datetime=${dateTimeQuery}&limit=5`);
    if (!datetimeResponse.ok) {
      throw new Error(`Datetime query failed with status ${datetimeResponse.status}`);
    }
    const datetimeData = await datetimeResponse.json();
    logger.info('Datetime query successful');
    logger.info('Number of features returned:', datetimeData.features.length);
    
    logger.info('\nAll OGC API tests completed successfully!');
  } catch (error) {
    logger.error('Error testing OGC API:', error);
  }
}

// Run the tests with delay to allow server to start
async function run() {
  logger.info('Waiting for server to start...');
  await delay(5000); // Wait 5 seconds
  await testOgcApi();
}

run();