#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load dotenv directly
dotenv.config({ path: '.env.development' });

async function main() {
  // Test each EAS endpoint
  const endpoints = {
    arbitrum: process.env.EAS_ENDPOINT_ARBITRUM,
    celo: process.env.EAS_ENDPOINT_CELO,
    sepolia: process.env.EAS_ENDPOINT_SEPOLIA,
    base: process.env.EAS_ENDPOINT_BASE,
  };

  const schemaUID = process.env.EAS_SCHEMA_UID || '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2';
  
  // Use a timestamp from 6 months ago to ensure we get some data
  const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
  
  console.log('Environment variables loaded:');
  console.log('Schema UID:', schemaUID);
  console.log('Timestamp:', sixMonthsAgo, `(${new Date(sixMonthsAgo * 1000).toISOString()})`);

  // First, let's test a simpler query to get schema information
  for (const [chain, endpoint] of Object.entries(endpoints)) {
    if (!endpoint) {
      console.log(`⚠️ No endpoint configured for ${chain}`);
      continue;
    }
    
    console.log(`\n📡 Testing ${chain} endpoint: ${endpoint}`);
    
    try {
      // Simple query to get schema information - corrected fields
      const schemaQuery = {
        query: `{ 
          schema(where: { id: "${schemaUID}" }) { 
            id 
            schema 
            resolver
            revocable
          } 
        }`
      };
      
      console.log(`Checking if schema exists...`);
      
      const schemaResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemaQuery)
      });
      
      const schemaResult = await schemaResponse.json();
      
      if (schemaResult.errors) {
        console.log(`❌ Schema query error: ${JSON.stringify(schemaResult.errors)}`);
        continue;
      }
      
      if (!schemaResult.data?.schema) {
        console.log(`⚠️ Schema not found on ${chain}`);
        continue;
      }
      
      console.log(`✅ Schema found on ${chain}:`);
      console.log(`  - Schema: ${schemaResult.data.schema.schema}`);
      console.log(`  - Resolver: ${schemaResult.data.schema.resolver}`);
      console.log(`  - Revocable: ${schemaResult.data.schema.revocable}`);
      
      // Now try to fetch attestations
      // Now query for attestations with updated syntax
      const attestationQuery = {
        query: `{ 
          attestations(
            where: { 
              schemaId: { equals: "${schemaUID}" }
              timeCreated: { gt: ${sixMonthsAgo} }
            }
            take: 5
            orderBy: { timeCreated: desc }
          ) { 
            id
            attester
            recipient
            revocationTime
            timeCreated
            data {
              decodedDataJson
            }
          } 
        }`
      };
      
      console.log(`Fetching attestations...`);
      
      const attestationResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestationQuery)
      });
      
      const attestationResult = await attestationResponse.json();
      
      if (attestationResult.errors) {
        console.log(`❌ Attestation query error: ${JSON.stringify(attestationResult.errors)}`);
        continue;
      }
      
      const attestations = attestationResult.data?.attestations || [];
      
      if (attestations.length === 0) {
        console.log(`❓ No attestations found for this schema on ${chain}`);
        continue;
      }
      
      console.log(`✅ Found ${attestations.length} attestations on ${chain}:`);
      
      // Print first attestation details
      const first = attestations[0];
      console.log(`  - ID: ${first.id}`);
      console.log(`  - Attester: ${first.attester}`);
      console.log(`  - Time: ${new Date(parseInt(first.timeCreated) * 1000).toISOString()}`);
      
      // Parse and display location data from the first attestation
      try {
        if (first.data.decodedDataJson) {
          const decodedData = JSON.parse(first.data.decodedDataJson);
          console.log(`  - Decoded data available: ${decodedData.length} fields`);
          
          for (const field of decodedData) {
            console.log(`    - ${field.name}: ${field.value?.value}`);
          }
        } else {
          console.log(`  - No decoded data available`);
        }
      } catch (error) {
        console.log(`  - Could not parse decoded data: ${error}`);
      }
    } catch (error) {
      console.log(`❌ Error querying ${chain}: ${error}`);
    }
  }
}

main().catch(console.error);