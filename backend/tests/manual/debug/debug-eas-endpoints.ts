#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables directly from .env.development
dotenv.config({ path: '.env.development' });

// Print all loaded environment variables related to EAS
console.log('EAS Environment Variables:');
console.log('-------------------------');
Object.keys(process.env).filter(key => key.startsWith('EAS_')).forEach(key => {
  console.log(`${key}: ${process.env[key]}`);
});
console.log('-------------------------\n');

async function main() {
  // Test the introspection query to understand the GraphQL schema
  const endpoints = {
    arbitrum: process.env.EAS_ENDPOINT_ARBITRUM,
    celo: process.env.EAS_ENDPOINT_CELO, 
    sepolia: process.env.EAS_ENDPOINT_SEPOLIA,
    base: process.env.EAS_ENDPOINT_BASE
  };

  for (const [chain, endpoint] of Object.entries(endpoints)) {
    if (!endpoint) {
      console.log(`⚠️ No endpoint configured for ${chain}`);
      continue;
    }
    
    console.log(`\n📡 Testing ${chain} endpoint: ${endpoint}`);
    
    // First, fetch the schema to understand the API
    try {
      const introspectionQuery = {
        query: `
          {
            __schema {
              queryType {
                fields {
                  name
                  description
                  args {
                    name
                    description
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        `
      };
      
      console.log('Testing GraphQL schema introspection...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(introspectionQuery)
      });
      
      if (!response.ok) {
        console.log(`🔴 Error: HTTP status ${response.status}`);
        console.log(await response.text());
        continue;
      }
      
      const result = await response.json();
      
      if (result.errors) {
        console.log(`🔴 GraphQL errors: ${JSON.stringify(result.errors)}`);
        continue;
      }
      
      // Find the attestations query
      const queryFields = result.data.__schema.queryType.fields;
      const attestationsField = queryFields.find((f: { name: string }) => f.name === 'attestations');
      
      if (!attestationsField) {
        console.log('❌ No attestations query found in schema');
        continue;
      }
      
      console.log('✅ Found attestations query with arguments:');
      attestationsField.args.forEach((arg: { name: string, type: { kind: string, name: string } }) => {
        console.log(`  - ${arg.name}: ${arg.type.kind}/${arg.type.name}`);
      });
      
      // Now test fetching a specific schema
      const schemaUID = process.env.EAS_SCHEMA_UID;
      
      if (!schemaUID) {
        console.log('❌ No EAS_SCHEMA_UID configured in environment');
        continue;
      }
      
      console.log(`\nTesting schema query with UID: ${schemaUID}`);
      
      const schemaQuery = {
        query: `
          {
            schema(where: {id: "${schemaUID}"}) {
              id
              schema
              revocable
            }
          }
        `
      };
      
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
        console.log(`⚠️ Schema not found: ${schemaUID}`);
        continue;
      }
      
      console.log(`✅ Schema found:`);
      console.log(`  Schema: ${schemaResult.data.schema.schema}`);
      
      // Finally, test for attestations using this schema
      console.log('\nTesting for attestations with this schema...');
      
      // Try fetching last 7 days worth
      const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      
      const attestationsQuery = {
        query: `
          {
            attestations(
              where: {
                schemaId: { equals: "${schemaUID}" }
                timeCreated: { gt: ${oneWeekAgo} }
              }
              take: 5
              orderBy: { timeCreated: desc }
            ) {
              id
              attester
              recipient
              revocationTime
              timeCreated
            }
          }
        `
      };
      
      const attestationsResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestationsQuery)
      });
      
      const attestationsResult = await attestationsResponse.json();
      
      if (attestationsResult.errors) {
        console.log(`❌ Attestations query error: ${JSON.stringify(attestationsResult.errors)}`);
        continue;
      }
      
      const attestations = attestationsResult.data?.attestations || [];
      
      if (attestations.length === 0) {
        console.log(`ℹ️ No recent attestations found for this schema (last 7 days)`);
        
        // Try a broader search
        console.log('Trying a broader search (last 6 months)...');
        
        const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
        
        const broaderQuery = {
          query: `
            {
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
              }
            }
          `
        };
        
        const broaderResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(broaderQuery)
        });
        
        const broaderResult = await broaderResponse.json();
        
        if (broaderResult.errors) {
          console.log(`❌ Broader query error: ${JSON.stringify(broaderResult.errors)}`);
          continue;
        }
        
        const broaderAttestations = broaderResult.data?.attestations || [];
        
        if (broaderAttestations.length === 0) {
          console.log(`❓ No attestations found for this schema in the last 6 months`);
        } else {
          console.log(`✅ Found ${broaderAttestations.length} attestations (older):`);
          broaderAttestations.forEach((att: { id: string, timeCreated: string, attester: string }) => {
            const date = new Date(parseInt(att.timeCreated) * 1000);
            console.log(`  - ID: ${att.id.substring(0, 10)}... | Time: ${date.toISOString()} | Attester: ${att.attester.substring(0, 8)}...`);
          });
        }
      } else {
        console.log(`✅ Found ${attestations.length} recent attestations:`);
        attestations.forEach((att: { id: string, timeCreated: string, attester: string }) => {
          const date = new Date(parseInt(att.timeCreated) * 1000);
          console.log(`  - ID: ${att.id.substring(0, 10)}... | Time: ${date.toISOString()} | Attester: ${att.attester.substring(0, 8)}...`);
        });
      }
    } catch (error) {
      console.log(`❌ Error testing ${chain}: ${error}`);
    }
  }
}

main().catch(console.error);