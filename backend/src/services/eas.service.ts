import { config, easEndpoints } from '../config';
import { LocationProof } from '../models/types';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { JsonRpcProvider } from 'ethers';
import { dbService, DbService } from './db.service';
import { logger } from '../utils/logger';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { supabaseService } from './supabase.service';

// Define the interfaces for EAS GraphQL responses
interface EASAttestation {
  id: string; // This is the UID
  attester: string;
  recipient: string | null;
  revocationTime: string; // "0" if not revoked
  timeCreated: string; // unix timestamp
  data: string; // The raw attestation data
  decodedDataJson: string; // JSON string of decoded data (may be directly on attestation or in data property)
}

interface GraphQLQueryResponse {
  data: {
    attestations: EASAttestation[];
  };
}

// Define a data structure for decoded attestation data
interface DecodedDataItem {
  name: string;
  type: string;
  value: {
    value: string | number | boolean | string[] | number[] | boolean[];
  };
}

// Get schema UID from config or environment
const schemaUID = config.EAS_SCHEMA_UID || process.env.EAS_SCHEMA_UID || 
  '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2';

// Map of chain names to EAS contract addresses and RPC URLs
const CHAIN_CONFIG = {
  arbitrum: {
    rpcUrl: 'https://arbitrum-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    contractAddress: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
    schemaUID
  },
  celo: {
    rpcUrl: 'https://celo-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    contractAddress: '0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92',
    schemaUID
  },
  sepolia: {
    rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    contractAddress: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    schemaUID
  },
  base: {
    rpcUrl: 'https://base-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    contractAddress: '0x4200000000000000000000000000000000000021',
    schemaUID
  }
};

// Define the schema string for location proofs
const SCHEMA_STRING = "uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo";

export class EasService {
  private dbService: DbService;
  private providers: Record<string, JsonRpcProvider>;
  private easClients: Record<string, EAS>;
  private graphqlClients: Record<string, ApolloClient<unknown>>;
  private lastProcessedTimestamps: Record<string, number>;
  private schemaEncoder: SchemaEncoder;
  private chainConfigs: typeof CHAIN_CONFIG;
  
  // GraphQL query to fetch attestations with correct syntax
  private ATTESTATIONS_QUERY = gql`
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
  
  constructor(dbService: DbService) {
    this.dbService = dbService;
    this.providers = {};
    this.easClients = {};
    this.graphqlClients = {};
    this.lastProcessedTimestamps = {};
    this.schemaEncoder = new SchemaEncoder(SCHEMA_STRING);
    this.chainConfigs = CHAIN_CONFIG;
    
    // Initialize providers, EAS clients, and GraphQL clients for each supported chain
    for (const [chain, chainConfig] of Object.entries(CHAIN_CONFIG)) {
      try {
        // Initialize providers and EAS clients
        const provider = new JsonRpcProvider(chainConfig.rpcUrl);
        this.providers[chain] = provider;
        
        const eas = new EAS(chainConfig.contractAddress);
        // Use as unknown to bypass TypeScript checking since EAS.connect exists but TypeScript doesn't see it
        (eas as unknown as { connect: (provider: JsonRpcProvider) => void }).connect(provider);
        this.easClients[chain] = eas;
        
        // Initialize GraphQL clients for each chain if endpoints are available
        // First try from config
        let endpoint = easEndpoints[chain as keyof typeof easEndpoints];
        
        // If not found, try environment variables directly
        if (!endpoint) {
          const envVarName = `EAS_ENDPOINT_${chain.toUpperCase()}`;
          endpoint = process.env[envVarName];
        }
        
        if (endpoint) {
          this.graphqlClients[chain] = new ApolloClient({
            uri: endpoint,
            cache: new InMemoryCache(),
          });
          logger.info(`Initialized GraphQL client for ${chain} with endpoint ${endpoint}`);
        } else {
          logger.warn(`No GraphQL endpoint configured for ${chain}, attestation fetching will be limited`);
        }
        
        logger.info(`Initialized EAS client for ${chain}`);
      } catch (error) {
        logger.error(`Failed to initialize EAS client for ${chain}`, error);
      }
    }
  }
  
  /**
   * Initialize last processed timestamps from the database
   */
  async initialize(): Promise<void> {
    try {
      // For each chain that has a GraphQL client, get the latest timestamp from the database
      for (const chain of Object.keys(this.graphqlClients)) {
        try {
          // First try with dbService
          const result = await this.dbService.getLatestLocationProofTimestamp(chain);
          if (result) {
            // Convert to Unix timestamp
            this.lastProcessedTimestamps[chain] = Math.floor(result.getTime() / 1000);
          } else {
            // If no records, start from the beginning of 2023 to get all historical data
            const beginningOf2023 = new Date('2023-01-01T00:00:00Z');
            this.lastProcessedTimestamps[chain] = Math.floor(beginningOf2023.getTime() / 1000);
          }
        } catch (dbError) {
          // Fall back to Supabase if available
          logger.warn(`Failed to get timestamp from DbService for ${chain}, trying Supabase fallback`);
          if (supabaseService && supabaseService.isAvailable()) {
            const result = await supabaseService.getLatestLocationProofTimestamp(chain);
            if (result) {
              // Convert to Unix timestamp
              this.lastProcessedTimestamps[chain] = Math.floor(result.getTime() / 1000);
            } else {
              // If no records, start from the beginning of 2023 to get all historical data
              const beginningOf2023 = new Date('2023-01-01T00:00:00Z');
              this.lastProcessedTimestamps[chain] = Math.floor(beginningOf2023.getTime() / 1000);
            }
          } else {
            // If Supabase is not available, just use a default timestamp
            logger.warn(`No database connection available for ${chain}, using default timestamp`);
            const beginningOf2023 = new Date('2023-01-01T00:00:00Z');
            this.lastProcessedTimestamps[chain] = Math.floor(beginningOf2023.getTime() / 1000);
          }
        }
        
        logger.info(`Initialized ${chain} with last timestamp: ${new Date(this.lastProcessedTimestamps[chain] * 1000).toISOString()}`);
      }
    } catch (error) {
      logger.error('Failed to initialize last processed timestamps', error);
      throw error;
    }
  }
  
  /**
   * Fetch attestations from a chain starting from a specific timestamp
   * 
   * @param chain The chain to fetch attestations from
   * @param limit The maximum number of attestations to fetch
   * @param fromTimestamp The timestamp to start fetching from (ISO string)
   * @returns An array of EAS attestations
   */
  async fetchAttestations(chain: string, limit: number = 100, fromTimestamp?: string): Promise<EASAttestation[]> {
    if (!this.easClients[chain]) {
      throw new Error(`Chain ${chain} is not supported`);
    }
    
    // Get GraphQL client for the chain
    const client = this.graphqlClients[chain];
    if (!client) {
      logger.warn(`No GraphQL client available for ${chain}, cannot fetch attestations`);
      return [];
    }
    
    let timestampUnix: number;
    
    if (fromTimestamp) {
      // Convert ISO timestamp to Unix timestamp (seconds)
      timestampUnix = Math.floor(new Date(fromTimestamp).getTime() / 1000);
    } else {
      // Default to beginning of 2023 for all historical data
      timestampUnix = Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000);
    }
    
    // GraphQL Int is 32-bit signed integer (max: 2147483647), so we need to ensure the timestamp fits
    const maxSafeInt = 2147483647;
    // Use the smaller of our timestamp or maxSafeInt to avoid overflow
    const safeTimestamp = Math.min(timestampUnix, maxSafeInt);
    
    // Log the schema UID being used
    const schemaId = this.chainConfigs[chain as keyof typeof CHAIN_CONFIG].schemaUID;
    logger.info(`Using schema UID for ${chain}: ${schemaId}`);
    
    // Retry logic for GraphQL queries
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        logger.info(`Fetching ${limit} attestations for ${chain} since ${new Date(safeTimestamp * 1000).toISOString()} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Create a custom query with the specified limit
        const query = gql`
          query GetAttestations($schemaId: String!, $timestamp: Int!, $limit: Int!) {
            attestations(
              where: {
                schemaId: {
                  equals: $schemaId
                }
                timeCreated: {
                  gt: $timestamp
                }
              }
              take: $limit
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
        
        // Query the EAS indexer via GraphQL with timeout
        const response = await Promise.race([
          client.query({
            query,
            variables: {
              schemaId,
              timestamp: safeTimestamp,
              limit
            },
            fetchPolicy: 'network-only' // Skip cache to ensure fresh data
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`GraphQL query timed out after 30s for chain ${chain}`)), 30000)
          )
        ]) as GraphQLQueryResponse;
        
        const attestations = response.data.attestations;
        
        logger.info(`Successfully fetched ${attestations.length} attestations from ${chain}`);
        return attestations;
      } catch (error) {
        retryCount++;
        logger.error(`Error fetching attestations from ${chain} (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          logger.error(`Failed to fetch attestations from ${chain} after ${maxRetries} attempts`);
          throw error;
        }
        
        // Exponential backoff: 2^retryCount * 1000ms (2s, 4s, 8s, ...)
        const backoffTime = Math.pow(2, retryCount) * 1000;
        logger.info(`Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    
    // This should never execute due to the throw in the catch block above
    return [];
  }
  
  /**
   * Convert an EAS attestation to a LocationProof
   * 
   * @param attestation The EAS attestation
   * @param chain The chain the attestation is from
   * @returns A LocationProof object
   */
  async convertAttestationToLocationProof(attestation: EASAttestation, chain: string): Promise<LocationProof> {
    try {
      // Decode the attestation data from the JSON string
      const decodedData = JSON.parse(attestation.decodedDataJson);
      
      // Helper function to find a value in the decoded data by name
      const findValue = (name: string) => {
        const item = decodedData.find((item: DecodedDataItem) => item.name === name);
        return item ? item.value.value : null;
      };
      
      // Extract values from the decoded data
      const eventTimestamp = findValue('eventTimestamp');
      const srs = findValue('srs') || 'WGS84'; // Default to WGS84 if not specified
      const locationType = findValue('locationType') || 'point';
      const location = findValue('location') || '';
      const recipeTypes = findValue('recipeType') || [];
      const recipePayloads = findValue('recipePayload') || [];
      const mediaTypes = findValue('mediaType') || [];
      const mediaData = findValue('mediaData') || [];
      const memo = findValue('memo') || '';
      
      // Parse coordinates from the location string
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      
      // Try to parse GeoJSON format first
      if (location) {
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
              logger.info(`Parsed GeoJSON ${parsedLocation.type}: [${coords[0]}, ${coords[1]}]`);
            }
          } 
          // Feature
          else if (parsedLocation.type === 'Feature' && parsedLocation.geometry) {
            coords = extractFirstCoordinate(parsedLocation.geometry);
            if (coords) {
              logger.info(`Parsed GeoJSON Feature with ${parsedLocation.geometry.type}: [${coords[0]}, ${coords[1]}]`);
            }
          }
          // FeatureCollection
          else if (parsedLocation.type === 'FeatureCollection' && 
                  Array.isArray(parsedLocation.features) && 
                  parsedLocation.features.length > 0 &&
                  parsedLocation.features[0].geometry) {
            coords = extractFirstCoordinate(parsedLocation.features[0].geometry);
            if (coords) {
              logger.info(`Parsed GeoJSON FeatureCollection (first feature is ${parsedLocation.features[0].geometry.type}): [${coords[0]}, ${coords[1]}]`);
            }
          }
          
          // If coordinates were found, validate and assign them
          if (coords) {
            // GeoJSON coordinates are in [longitude, latitude] order
            longitude = coords[0];
            latitude = coords[1];
            
            // Validate coordinate ranges
            if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
              logger.warn(`Invalid GeoJSON coordinates: [${longitude}, ${latitude}]`);
              latitude = undefined;
              longitude = undefined;
            }
          }
        } catch (e) {
          // Not JSON or invalid JSON - try other parsing methods
          // No need to log here, will attempt other formats
        }
      }
      
      // If GeoJSON parsing didn't work, try simple coordinate format
      if (latitude === undefined || longitude === undefined) {
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
                latitude = undefined;
                longitude = undefined;
              } else {
                // Determine which is latitude and which is longitude based on value ranges
                // Latitude: -90 to 90, Longitude: -180 to 180
                if (Math.abs(val1) <= 90 && Math.abs(val2) <= 180) {
                  // Standard "lat,lng" format
                  latitude = val1;
                  longitude = val2;
                } else if (Math.abs(val2) <= 90 && Math.abs(val1) <= 180) {
                  // Reversed "lng,lat" format
                  latitude = val2;
                  longitude = val1;
                } else {
                  // Values out of range, might not be coordinates
                  logger.warn(`Coordinate values out of range in '${location}'`);
                  latitude = undefined;
                  longitude = undefined;
                }
              }
            } catch (e) {
              // Keep as undefined if parsing fails
              logger.warn(`Failed to parse coordinates from '${location}'`, e);
            }
          }
        }
      }
      
      // Parse timestamps - handle potential parsing errors
      let timestamp: Date;
      let event_timestamp: Date;
      
      try {
        const timeCreated = parseInt(attestation.timeCreated) * 1000; // Convert to milliseconds
        timestamp = new Date(timeCreated);
        
        // If timestamp is invalid, use current time
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
          logger.warn(`Invalid timestamp in attestation ${attestation.id}, using current time`);
        }
        
        // Parse event timestamp
        if (eventTimestamp) {
          const eventTime = parseInt(eventTimestamp) * 1000;
          event_timestamp = new Date(eventTime);
          
          // If event timestamp is invalid, use attestation time
          if (isNaN(event_timestamp.getTime())) {
            event_timestamp = timestamp;
            logger.warn(`Invalid event timestamp in attestation ${attestation.id}, using attestation time`);
          }
        } else {
          event_timestamp = timestamp;
        }
      } catch (error) {
        logger.warn(`Error parsing timestamps for attestation ${attestation.id}, using current time`, error);
        timestamp = new Date();
        event_timestamp = new Date();
      }
      
      // Check if attestation is revoked
      const revoked = attestation.revocationTime !== "0";
      
      // Create the location proof
      const proof: LocationProof = {
        uid: attestation.id,
        chain,
        prover: attestation.attester,
        subject: attestation.recipient || attestation.attester,
        timestamp,
        event_timestamp,
        srs,
        location_type: locationType,
        location,
        longitude,
        latitude,
        recipe_types: recipeTypes,
        recipe_payloads: recipePayloads,
        media_types: mediaTypes,
        media_data: mediaData,
        memo,
        revoked,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      return proof;
    } catch (error) {
      logger.error(`Failed to convert attestation ${attestation.id} to location proof`, error);
      throw error;
    }
  }
  
  /**
   * Fetch recent attestations from a specific chain
   * 
   * @param chain The chain to fetch attestations from
   * @returns An array of EAS attestations
   */
  async fetchRecentAttestations(chain: string): Promise<EASAttestation[]> {
    // Get the last week of attestations
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return this.fetchAttestations(chain, 100, oneWeekAgo.toISOString());
  }
  
  /**
   * Process attestations for a single chain
   */
  async processChain(chain: string): Promise<number> {
    try {
      const timestamp = this.lastProcessedTimestamps[chain] || Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7; // Default to 7 days ago
      const schemaUID = this.chainConfigs[chain as keyof typeof CHAIN_CONFIG].schemaUID;

      logger.info(`Fetching attestations for ${chain} since ${new Date(timestamp * 1000).toISOString()}`);
      
      // GraphQL Int is 32-bit signed integer (max: 2147483647), so we need to ensure the timestamp fits
      const maxSafeInt = 2147483647;
      // Use the smaller of our timestamp or maxSafeInt to avoid overflow
      const safeTimestamp = Math.min(timestamp, maxSafeInt);
      
      // Query the EAS indexer via GraphQL
      const attestations = await this.fetchAttestations(chain, 100, new Date(safeTimestamp * 1000).toISOString());
      
      if (attestations.length === 0) {
        logger.info(`No attestations found for chain ${chain}`);
        return 0;
      }
      
      logger.info(`Processing ${attestations.length} attestations from ${chain}`);
      
      let processedCount = 0;
      
      // Process each attestation
      for (const attestation of attestations) {
        try {
          // Check if we already have this attestation
          let exists = false;
          
          try {
            exists = await this.dbService.locationProofExists(attestation.id);
          } catch (error) {
            // Fall back to Supabase if DbService fails
            logger.warn(`DbService.locationProofExists failed, falling back to Supabase: ${(error as Error).message}`);
            if (supabaseService && supabaseService.isAvailable()) {
              exists = await supabaseService.locationProofExists(attestation.id);
            } else {
              throw error; // Re-throw if no fallback available
            }
          }
          
          if (!exists) {
            // Convert the attestation to a location proof
            const locationProof = await this.convertAttestationToLocationProof(attestation, chain);
            
            // Store in database (try DbService first, fall back to Supabase)
            try {
              await this.dbService.createLocationProof(locationProof);
            } catch (error) {
              // Fall back to Supabase if DbService fails
              logger.warn(`DbService.createLocationProof failed, falling back to Supabase: ${(error as Error).message}`);
              if (supabaseService && supabaseService.isAvailable()) {
                await supabaseService.createLocationProof(locationProof);
              } else {
                throw error; // Re-throw if no fallback available
              }
            }
            
            processedCount++;
          } else {
            logger.debug(`Attestation ${attestation.id} already exists in database`);
          }
        } catch (error) {
          logger.error(`Error processing attestation ${attestation.id}`, error);
          // Continue with next attestation
        }
      }
      
      // Update last processed timestamp if we got any attestations
      if (attestations.length > 0) {
        const lastAttestationTime = Math.max(...attestations.map(a => parseInt(a.timeCreated)));
        this.lastProcessedTimestamps[chain] = lastAttestationTime;
        logger.info(`Updated last timestamp for ${chain} to ${new Date(lastAttestationTime * 1000).toISOString()}`);
      }
      
      return processedCount;
    } catch (error) {
      logger.error(`Error processing chain ${chain}`, error);
      throw error;
    }
  }
  
  /**
   * Process all chains
   */
  async processAllChains(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    
    for (const chain of Object.keys(this.graphqlClients)) {
      try {
        const count = await this.processChain(chain);
        results[chain] = count;
      } catch (error) {
        logger.error(`Failed to process chain ${chain}`, error);
        results[chain] = 0;
      }
    }
    
    return results;
  }
  
  /**
   * Helper to find a value in decoded data by name
   */
  private findValue(decodedData: DecodedDataItem[], name: string): string | number | boolean | string[] | number[] | boolean[] | null {
    const item = decodedData.find(item => item.name === name);
    return item ? item.value.value : null;
  }

  /**
   * Check revocation status for a list of attestations
   * 
   * @param chain The chain to check revocation on
   * @param uids List of attestation UIDs to check
   * @returns Array of UIDs that have been revoked
   */
  async checkRevocationStatus(chain: string, uids: string[]): Promise<string[]> {
    if (!this.easClients[chain]) {
      throw new Error(`Chain ${chain} is not supported`);
    }

    // Check if we have a GraphQL client for this chain
    const client = this.graphqlClients[chain];
    if (!client) {
      logger.warn(`No GraphQL client available for ${chain}, cannot check revocation status`);
      return [];
    }

    if (uids.length === 0) {
      return [];
    }

    try {
      // Create a GraphQL query to get revocation status for UIDs
      const query = gql`
        query CheckRevocation($uids: [String!]!) {
          attestations(where: { id: { in: $uids } }) {
            id
            revocationTime
          }
        }
      `;

      // Execute the query
      const response = await client.query({
        query,
        variables: {
          uids
        },
        fetchPolicy: 'network-only' // Skip cache to get fresh data
      });

      // Extract revoked attestations (revocationTime != "0")
      const revokedUids = response.data.attestations
        .filter((att: { id: string; revocationTime: string }) => att.revocationTime !== "0")
        .map((att: { id: string }) => att.id);

      logger.info(`Found ${revokedUids.length} revoked attestations out of ${uids.length} checked on ${chain}`);
      return revokedUids;
    } catch (error) {
      logger.error(`Error checking revocation status on chain ${chain}`, error);
      throw error;
    }
  }

  /**
   * Get GraphQL clients for all chains
   */
  getGraphQLClients(): Record<string, ApolloClient<unknown>> {
    return this.graphqlClients;
  }
}

// Create a singleton instance to export
export const easService = new EasService(dbService);