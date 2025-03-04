/**
 * Test script for the GraphQL API implementation
 * Tests basic queries and mutations to ensure the GraphQL API is functioning correctly
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger';

// Base URL for the API
const baseUrl = 'http://localhost:3000/graphql';

// Helper function to send GraphQL queries
async function executeGraphQL(query: string, variables: any = {}) {
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    return await response.json();
  } catch (error) {
    logger.error('Error executing GraphQL query:', error);
    throw error;
  }
}

// Test queries
async function testGraphQL() {
  try {
    logger.info('Testing GraphQL API...');

    // Test 1: Get stats
    logger.info('\n1. Testing locationProofsStats query...');
    const statsQuery = `
      query GetStats {
        locationProofsStats {
          total
          byChain {
            chain
            count
          }
        }
      }
    `;
    const statsResult = await executeGraphQL(statsQuery);
    logger.info('Stats query result:', statsResult);

    // Test 2: Query location proofs with limit
    logger.info('\n2. Testing locationProofs query with limit...');
    const proofsQuery = `
      query GetProofs {
        locationProofs(filter: { limit: 3 }) {
          uid
          chain
          prover
          eventTimestamp
          locationType
          revoked
        }
      }
    `;
    const proofsResult = await executeGraphQL(proofsQuery);
    logger.info('Proofs query result:', proofsResult);
    
    // If we have location proofs, get one by ID
    if (proofsResult.data?.locationProofs?.length > 0) {
      const uid = proofsResult.data.locationProofs[0].uid;
      
      // Test 3: Get single location proof by ID
      logger.info(`\n3. Testing locationProof query with UID ${uid}...`);
      const proofQuery = `
        query GetProof($uid: ID!) {
          locationProof(uid: $uid) {
            uid
            chain
            prover
            subject
            eventTimestamp
            locationType
            location
            longitude
            latitude
            geometry {
              type
              coordinates
            }
            revoked
          }
        }
      `;
      const proofResult = await executeGraphQL(proofQuery, { uid });
      logger.info('Single proof query result:', proofResult);
    }
    
    // Test 4: Count location proofs with filter
    logger.info('\n4. Testing locationProofsCount query with filter...');
    const countQuery = `
      query CountProofs($filter: LocationProofFilter) {
        locationProofsCount(filter: $filter)
      }
    `;
    const countResult = await executeGraphQL(countQuery, { 
      filter: { chain: 'sepolia' } 
    });
    logger.info('Count query result:', countResult);
    
    // Note: No mutation tests as the API is intentionally read-only
    
    logger.info('\nAll GraphQL tests completed!');
  } catch (error) {
    logger.error('Error testing GraphQL API:', error);
  }
}

// Run the tests
async function run() {
  logger.info('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  await testGraphQL();
}

run();