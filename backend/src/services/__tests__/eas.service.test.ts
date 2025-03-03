import { EasService } from '../eas.service';
import { DbService } from '../db.service';
import { LocationProof } from '../../models/types';

// Mock the config
jest.mock('../../config', () => ({
  config: {
    EAS_ENDPOINT_ARBITRUM: 'https://arbitrum.example.com/graphql',
    EAS_ENDPOINT_CELO: 'https://celo.example.com/graphql',
    EAS_ENDPOINT_SEPOLIA: 'https://sepolia.example.com/graphql',
    EAS_ENDPOINT_BASE: 'https://base.example.com/graphql',
    EAS_SCHEMA_UID: '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname'
  }
}));

// Mock the DbService
jest.mock('../db.service');

// Mock the Apollo client
jest.mock('@apollo/client/core', () => ({
  ApolloClient: jest.fn(() => ({
    query: jest.fn()
  })),
  InMemoryCache: jest.fn(),
  gql: jest.fn(query => query)
}));

describe('EasService', () => {
  let easService: EasService;
  let mockDbService: jest.Mocked<DbService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a mock DbService
    mockDbService = new DbService() as jest.Mocked<DbService>;
    
    // Create the EasService with the mock DbService
    easService = new EasService(mockDbService);
    
    // Mock any private properties
    (easService as any).clients = {
      arbitrum: { query: jest.fn() },
      celo: { query: jest.fn() },
      sepolia: { query: jest.fn() },
      base: { query: jest.fn() }
    };
    
    (easService as any).lastProcessedTimestamps = {
      arbitrum: '2023-01-01T00:00:00.000Z',
      celo: '2023-01-01T00:00:00.000Z',
      sepolia: '2023-01-01T00:00:00.000Z',
      base: '2023-01-01T00:00:00.000Z'
    };
  });
  
  describe('initialize', () => {
    it('should initialize lastProcessedTimestamps from database', async () => {
      // Mock timestamp returned from database
      const timestamp = new Date('2023-03-01T12:00:00Z');
      mockDbService.getLatestLocationProofTimestamp.mockResolvedValue(timestamp);
      
      // Call initialize
      await easService.initialize();
      
      // Expect getLatestLocationProofTimestamp to be called for each chain
      expect(mockDbService.getLatestLocationProofTimestamp).toHaveBeenCalledTimes(4);
      expect(mockDbService.getLatestLocationProofTimestamp).toHaveBeenCalledWith('arbitrum');
      expect(mockDbService.getLatestLocationProofTimestamp).toHaveBeenCalledWith('celo');
      expect(mockDbService.getLatestLocationProofTimestamp).toHaveBeenCalledWith('sepolia');
      expect(mockDbService.getLatestLocationProofTimestamp).toHaveBeenCalledWith('base');
      
      // Verify timestamps were set
      expect((easService as any).lastProcessedTimestamps.arbitrum).toBe(timestamp.toISOString());
      expect((easService as any).lastProcessedTimestamps.celo).toBe(timestamp.toISOString());
      expect((easService as any).lastProcessedTimestamps.sepolia).toBe(timestamp.toISOString());
      expect((easService as any).lastProcessedTimestamps.base).toBe(timestamp.toISOString());
    });
    
    it('should use default timestamp if no records found', async () => {
      // Mock no timestamp returned from database
      mockDbService.getLatestLocationProofTimestamp.mockResolvedValue(null);
      
      // Call initialize
      await easService.initialize();
      
      // Verify default timestamp was set (should be around 7 days ago)
      // This is approximate since we can't know the exact time the test will run
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Parse timestamp to compare dates (ignoring exact time)
      const parsedArbitrumTimestamp = new Date((easService as any).lastProcessedTimestamps.arbitrum);
      expect(Math.abs(parsedArbitrumTimestamp.getTime() - oneWeekAgo.getTime())).toBeLessThan(1000 * 60 * 60); // Within an hour
    });
  });
  
  describe('fetchAttestations', () => {
    it('should fetch and parse attestations correctly', async () => {
      // Mock Apollo client response
      const mockResponse = {
        data: {
          attestations: [
            {
              id: 'attestation1',
              attester: '0x123',
              recipient: '0x456',
              revocationTime: '0',
              timeCreated: '1679616000', // March 24, 2023
              data: {
                decodedDataJson: JSON.stringify([
                  { name: 'latitude', type: 'float', value: { value: '40.7128' } },
                  { name: 'longitude', type: 'float', value: { value: '-74.0060' } },
                  { name: 'timestamp', type: 'uint256', value: { value: '1679616000' } },
                  { name: 'locationData', type: 'string', value: { value: 'New York, NY' } },
                  { name: 'locationType', type: 'string', value: { value: 'point' } },
                  { name: 'memo', type: 'string', value: { value: 'Test location' } }
                ])
              }
            }
          ]
        }
      };
      
      // Set up the mock
      (easService as any).clients.arbitrum.query.mockResolvedValue(mockResponse);
      
      // Call fetchAttestations
      const result = await easService.fetchAttestations('arbitrum');
      
      // Verify query was called with correct parameters
      expect((easService as any).clients.arbitrum.query).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            schemaId: expect.any(String),
            timestamp: expect.any(String)
          })
        })
      );
      
      // Verify results
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uid: 'attestation1',
        chain: 'arbitrum',
        prover: '0x123',
        subject: '0x456',
        timestamp: new Date(1679616000 * 1000),
        event_timestamp: new Date(1679616000 * 1000),
        srs: 'WGS84',
        location_type: 'point',
        location: 'New York, NY',
        longitude: -74.0060,
        latitude: 40.7128,
        memo: 'Test location',
        revoked: false
      });
      
      // Verify last processed timestamp was updated
      expect((easService as any).lastProcessedTimestamps.arbitrum).toBe(new Date(1679616000 * 1000).toISOString());
    });
    
    it('should handle empty attestations correctly', async () => {
      // Mock empty response
      (easService as any).clients.arbitrum.query.mockResolvedValue({
        data: { attestations: [] }
      });
      
      // Call fetchAttestations
      const result = await easService.fetchAttestations('arbitrum');
      
      // Verify results
      expect(result).toHaveLength(0);
      
      // Verify last processed timestamp was not updated
      expect((easService as any).lastProcessedTimestamps.arbitrum).toBe('2023-01-01T00:00:00.000Z');
    });
    
    it('should throw error for unsupported chain', async () => {
      // Call fetchAttestations with unsupported chain
      await expect(easService.fetchAttestations('unknown')).rejects.toThrow('Chain unknown is not supported');
    });
  });
  
  describe('ingestAttestations', () => {
    it('should ingest attestations correctly', async () => {
      // Mock fetchAttestations to return attestations
      const mockAttestations: LocationProof[] = [{
        uid: 'attestation1',
        chain: 'arbitrum',
        prover: '0x123',
        subject: '0x456',
        timestamp: new Date(),
        event_timestamp: new Date(),
        srs: 'WGS84',
        location_type: 'point',
        location: 'New York, NY',
        longitude: -74.0060,
        latitude: 40.7128,
        recipe_types: [],
        recipe_payloads: [],
        media_types: [],
        media_data: [],
        memo: 'Test location',
        revoked: false,
        created_at: new Date(),
        updated_at: new Date()
      }];
      
      jest.spyOn(easService, 'fetchAttestations').mockResolvedValue(mockAttestations);
      
      // Call ingestAttestations
      const result = await easService.ingestAttestations('arbitrum');
      
      // Verify fetchAttestations was called
      expect(easService.fetchAttestations).toHaveBeenCalledWith('arbitrum');
      
      // Verify createLocationProof was called
      expect(mockDbService.createLocationProof).toHaveBeenCalledWith(mockAttestations[0]);
      
      // Verify result
      expect(result).toBe(1);
    });
    
    it('should handle no attestations correctly', async () => {
      // Mock fetchAttestations to return no attestations
      jest.spyOn(easService, 'fetchAttestations').mockResolvedValue([]);
      
      // Call ingestAttestations
      const result = await easService.ingestAttestations('arbitrum');
      
      // Verify result
      expect(result).toBe(0);
      
      // Verify createLocationProof was not called
      expect(mockDbService.createLocationProof).not.toHaveBeenCalled();
    });
  });
  
  describe('processAllChains', () => {
    it('should process all chains correctly', async () => {
      // Reset the clients to have only arbitrum for simplicity
      (easService as any).clients = {
        arbitrum: { query: jest.fn() }
      };
      
      // Mock ingestAttestations 
      jest.spyOn(easService, 'ingestAttestations').mockResolvedValue(5);
      
      // Call processAllChains
      const result = await easService.processAllChains();
      
      // Verify ingestAttestations was called
      expect(easService.ingestAttestations).toHaveBeenCalledWith('arbitrum');
      
      // Verify results
      expect(result).toEqual({
        arbitrum: 5
      });
    });
    
    it('should handle errors for specific chains', async () => {
      // Set up clients to have two chains
      (easService as any).clients = {
        arbitrum: { query: jest.fn() },
        celo: { query: jest.fn() }
      };
      
      // Mock ingestAttestations to throw for one chain
      jest.spyOn(easService, 'ingestAttestations')
        .mockImplementationOnce(async () => 5) // arbitrum
        .mockImplementationOnce(async () => { throw new Error('Test error'); }); // celo
      
      // Call processAllChains
      const result = await easService.processAllChains();
      
      // Verify results - failed chain should be 0
      expect(result).toEqual({
        arbitrum: 5,
        celo: 0
      });
    });
  });
});