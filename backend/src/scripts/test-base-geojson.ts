/**
 * Script to test fetching and parsing GeoJSON attestations from Base chain
 * This script uses direct API calls without needing environment setup
 */
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';

// Use colored console logging
const log = {
  info: (msg: string) => console.log(`\x1b[32mINFO:\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33mWARN:\x1b[0m ${msg}`),
  error: (msg: string, error?: any) => console.log(`\x1b[31mERROR:\x1b[0m ${msg}`, error || '')
};

// Schema UID for location attestations
const SCHEMA_UID = '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2';

// Base chain GraphQL endpoint
const BASE_ENDPOINT = 'https://base.easscan.org/graphql';

// Query to fetch attestations
const ATTESTATIONS_QUERY = gql`
  query GetAttestations($schemaId: String!, $timestamp: Int!) {
    attestations(
      where: {
        schemaId: {
          equals: $schemaId
        }
        timeCreated: {
          gt: $timestamp
        }
      }
      take: 100
      orderBy: { timeCreated: asc }
    ) {
      id
      attester
      recipient
      revocationTime
      timeCreated
      data
      decodedDataJson
    }
  }
`;

// Helper function to extract coordinates from any GeoJSON geometry
function extractCoordinatesFromGeoJSON(location: string): { latitude?: number; longitude?: number } {
  let latitude: number | undefined = undefined;
  let longitude: number | undefined = undefined;
  
  try {
    // Try to parse as JSON first
    const parsedLocation = JSON.parse(location);
    
    // Helper function to extract first valid coordinate pair from any GeoJSON geometry
    const extractFirstCoordinate = (geom: any): [number, number] | null => {
      if (!geom || !geom.type || !geom.coordinates) return null;
      
      switch (geom.type) {
        case 'Point':
          // Point: [longitude, latitude]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
            return [geom.coordinates[0], geom.coordinates[1]];
          }
          break;
          
        case 'LineString':
          // LineString: [[lon1, lat1], [lon2, lat2], ...]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
              Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 2) {
            return [geom.coordinates[0][0], geom.coordinates[0][1]];
          }
          break;
          
        case 'Polygon':
          // Polygon: [[[lon1, lat1], [lon2, lat2], ...], [...]]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
              Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
              Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length >= 2) {
            return [geom.coordinates[0][0][0], geom.coordinates[0][0][1]];
          }
          break;
          
        case 'MultiPoint':
          // MultiPoint: [[lon1, lat1], [lon2, lat2], ...]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
              Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 2) {
            return [geom.coordinates[0][0], geom.coordinates[0][1]];
          }
          break;
          
        case 'MultiLineString':
          // MultiLineString: [[[lon1, lat1], [lon2, lat2], ...], [...]]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
              Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
              Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length >= 2) {
            return [geom.coordinates[0][0][0], geom.coordinates[0][0][1]];
          }
          break;
          
        case 'MultiPolygon':
          // MultiPolygon: [[[[lon1, lat1], [lon2, lat2], ...], [...]], [...]]
          if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && 
              Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0 &&
              Array.isArray(geom.coordinates[0][0]) && geom.coordinates[0][0].length > 0 &&
              Array.isArray(geom.coordinates[0][0][0]) && geom.coordinates[0][0][0].length >= 2) {
            return [geom.coordinates[0][0][0][0], geom.coordinates[0][0][0][1]];
          }
          break;
      }
      
      return null;
    };
    
    // Determine the type of GeoJSON
    let coords: [number, number] | null = null;
    
    // Direct geometry object
    if (parsedLocation.type && parsedLocation.coordinates) {
      coords = extractFirstCoordinate(parsedLocation);
      if (coords) {
        log.info(`Parsed GeoJSON ${parsedLocation.type}: [${coords[0]}, ${coords[1]}]`);
      }
    } 
    // Feature
    else if (parsedLocation.type === 'Feature' && parsedLocation.geometry) {
      coords = extractFirstCoordinate(parsedLocation.geometry);
      if (coords) {
        log.info(`Parsed GeoJSON Feature with ${parsedLocation.geometry.type}: [${coords[0]}, ${coords[1]}]`);
      }
    }
    // FeatureCollection
    else if (parsedLocation.type === 'FeatureCollection' && 
            Array.isArray(parsedLocation.features) && 
            parsedLocation.features.length > 0 &&
            parsedLocation.features[0].geometry) {
      coords = extractFirstCoordinate(parsedLocation.features[0].geometry);
      if (coords) {
        log.info(`Parsed GeoJSON FeatureCollection (first feature is ${parsedLocation.features[0].geometry.type}): [${coords[0]}, ${coords[1]}]`);
      }
    }
    
    // If coordinates were found, validate and assign them
    if (coords) {
      // GeoJSON coordinates are in [longitude, latitude] order
      longitude = coords[0];
      latitude = coords[1];
      
      // Validate coordinate ranges
      if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        log.warn(`Invalid GeoJSON coordinates: [${longitude}, ${latitude}]`);
        latitude = undefined;
        longitude = undefined;
      }
      
      return { latitude, longitude };
    }
  } catch (e) {
    // Not JSON or invalid JSON
    return { latitude: undefined, longitude: undefined };
  }
  
  return { latitude: undefined, longitude: undefined };
}

// Helper function to extract coordinates from a simple string
function extractCoordinatesFromString(location: string): { latitude?: number; longitude?: number } {
  let latitude: number | undefined = undefined;
  let longitude: number | undefined = undefined;
  
  // Try to parse simple coordinate format - could be "lat,lng" or "lng,lat"
  if (location && location.includes(',')) {
    const parts = location.split(',');
    if (parts.length === 2) {
      try {
        // Parse both values
        const val1 = parseFloat(parts[0].trim());
        const val2 = parseFloat(parts[1].trim());
        
        // Ensure values are valid numbers
        if (isNaN(val1) || isNaN(val2)) {
          return { latitude: undefined, longitude: undefined };
        }
        
        // Determine which is latitude and which is longitude based on value ranges
        // Latitude: -90 to 90, Longitude: -180 to 180
        if (Math.abs(val1) <= 90 && Math.abs(val2) <= 180) {
          // Standard "lat,lng" format
          latitude = val1;
          longitude = val2;
          log.info(`Parsed standard lat,lng format: [${longitude}, ${latitude}]`);
        } else if (Math.abs(val2) <= 90 && Math.abs(val1) <= 180) {
          // Reversed "lng,lat" format
          latitude = val2;
          longitude = val1;
          log.info(`Parsed reversed lng,lat format: [${longitude}, ${latitude}]`);
        } else {
          // Values out of range, might not be coordinates
          log.warn(`Coordinate values out of range in '${location}'`);
        }
      } catch (e) {
        // Keep as undefined if parsing fails
        log.warn(`Failed to parse coordinates from '${location}'`);
      }
    }
  }
  
  return { latitude, longitude };
}

async function testBaseGeojsonIngestion() {
  log.info('Starting Base chain GeoJSON attestation test...');
  
  try {
    // Initialize Apollo client
    const client = new ApolloClient({
      uri: BASE_ENDPOINT,
      cache: new InMemoryCache()
    });
    
    // Set timestamp to 14 days ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const timestamp = Math.floor(twoWeeksAgo.getTime() / 1000);
    
    log.info(`🔍 Fetching attestations from Base chain since ${new Date(timestamp * 1000).toISOString()}...`);
    
    // GraphQL Int is 32-bit signed integer (max: 2147483647), so we need to ensure the timestamp fits
    const maxSafeInt = 2147483647;
    // Use the smaller of our timestamp or maxSafeInt to avoid overflow
    const safeTimestamp = Math.min(timestamp, maxSafeInt);
    
    // Fetch attestations
    const response = await client.query({
      query: ATTESTATIONS_QUERY,
      variables: {
        schemaId: SCHEMA_UID,
        timestamp: safeTimestamp
      }
    });
    
    const attestations = response.data.attestations;
    log.info(`📊 Found ${attestations.length} attestations from Base chain`);
    
    if (attestations.length === 0) {
      log.info('No attestations found on Base chain during this time period.');
      return;
    }
    
    // Track format types
    let geojsonCount = 0;
    let simpleCoordCount = 0;
    let invalidFormatCount = 0;
    
    // Process each attestation
    log.info('\n🔎 Processing attestations...');
    
    for (const attestation of attestations) {
      try {
        // Extract location data
        const decodedData = JSON.parse(attestation.decodedDataJson);
        
        // Helper function to find values in the decoded data
        const findValue = (name: string) => {
          const item = decodedData.find((item: any) => item.name === name);
          return item ? item.value.value : null;
        };
        
        // Extract location value
        const location = findValue('location') || '';
        
        // Try to determine if it's GeoJSON
        let isGeoJSON = false;
        let latitude: number | undefined = undefined;
        let longitude: number | undefined = undefined;
        
        try {
          JSON.parse(location);
          isGeoJSON = true;
          const result = extractCoordinatesFromGeoJSON(location);
          latitude = result.latitude;
          longitude = result.longitude;
        } catch (e) {
          // Not JSON, try simple format
          isGeoJSON = false;
          const result = extractCoordinatesFromString(location);
          latitude = result.latitude;
          longitude = result.longitude;
        }
        
        // Classify the attestation
        if (isGeoJSON && latitude !== undefined && longitude !== undefined) {
          geojsonCount++;
          log.info(`✅ GeoJSON format: ${attestation.id.substring(0, 10)}... -> [${longitude}, ${latitude}]`);
          
          // Print a sample of the first GeoJSON for inspection
          if (geojsonCount === 1) {
            log.info(`Sample GeoJSON: ${location.substring(0, 150)}${location.length > 150 ? '...' : ''}`);
          }
        } else if (!isGeoJSON && latitude !== undefined && longitude !== undefined) {
          simpleCoordCount++;
          log.info(`✅ Simple coordinate format: ${attestation.id.substring(0, 10)}... -> [${longitude}, ${latitude}]`);
        } else {
          invalidFormatCount++;
          log.warn(`❌ Invalid/unparseable format: ${attestation.id.substring(0, 10)}... -> ${location.substring(0, 30)}${location.length > 30 ? '...' : ''}`);
        }
      } catch (error) {
        log.error(`Error processing attestation ${attestation.id}:`, error);
      }
    }
    
    // Print summary
    log.info('\n📊 ATTESTATION FORMAT SUMMARY:');
    log.info(`GeoJSON format: ${geojsonCount}`);
    log.info(`Simple coordinate format: ${simpleCoordCount}`);
    log.info(`Invalid/unparsed format: ${invalidFormatCount}`);
    log.info(`Total: ${attestations.length}`);
    
    log.info(`\n🎉 Successfully processed ${attestations.length} attestations from Base chain!`);
  } catch (error) {
    log.error('Error testing Base GeoJSON attestations:', error);
  }
}

// Run the test
testBaseGeojsonIngestion().catch(error => {
  log.error('Unhandled error in script:', error);
  process.exit(1);
});