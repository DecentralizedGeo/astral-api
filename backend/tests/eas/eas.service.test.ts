/**
 * Tests for EAS Service functionality
 */

import { EasService } from '../../src/services/eas.service';
import { DbService } from '../../src/services/db.service';

// Mock Apollo Client BEFORE any other imports
const mockApolloClient = {
  query: jest.fn(),
  stop: jest.fn(),
  clearStore: jest.fn(),
  cache: {
    reset: jest.fn()
  }
};

jest.mock('@apollo/client/core', () => ({
  ApolloClient: jest.fn(() => mockApolloClient),
  InMemoryCache: jest.fn(),
  gql: jest.fn((query: string) => query),
  createHttpLink: jest.fn()
}));

// Mock the dependencies
jest.mock('../../src/services/db.service');
jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock config
jest.mock('../../src/config', () => ({
  config: {
        EAS_SCHEMA_UID: '0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2'
    },
    easEndpoints: {
        arbitrum: 'https://arbitrum.easscan.org/graphql',
        celo: 'https://celo.easscan.org/graphql',
        sepolia: 'https://sepolia.easscan.org/graphql',
        base: 'https://base.easscan.org/graphql'
  }
}));

describe('EAS Service', () => {
  let easService: EasService;

  beforeAll(() => {
    // Use fake timers to prevent real setTimeout calls
    jest.useFakeTimers();
  });

  afterAll(async () => {
    // Restore real timers
    jest.useRealTimers();
    
    // Ensure Apollo Client is properly cleaned up
    if (mockApolloClient.stop) {
      await mockApolloClient.stop();
    }
    if (mockApolloClient.clearStore) {
      await mockApolloClient.clearStore();
    }
    // Force cleanup of any remaining handles
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
      // Reset all mocks
    jest.clearAllMocks();
    
    // Reset Apollo Client mock
    mockApolloClient.query.mockResolvedValue({
      data: {
        attestations: []
      }
    });
    
      // Create mock DbService
      const mockDbService = {
          createLocationProof: jest.fn().mockResolvedValue(undefined),
          testConnection: jest.fn().mockResolvedValue(true),
      };

      // Create service instance
      easService = new EasService(mockDbService as unknown as DbService);
  });

  afterEach(() => {
    // Clear any pending timers
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

    describe('processChain', () => {
        beforeEach(async () => {
        await easService.initialize();
    });

      it('should process chain successfully', async () => {
          // Mock fetchRecentAttestations
          jest.spyOn(easService, 'fetchRecentAttestations').mockResolvedValue([]);

        const result = await easService.processChain('arbitrum');

        expect(typeof result).toBe('number');
        expect(result).toBe(0);
    });

      it('should handle processing errors gracefully', async () => {
          jest.spyOn(easService, 'fetchRecentAttestations').mockRejectedValue(new Error('Network error'));

        const result = await easService.processChain('arbitrum');

        expect(result).toBe(0);
    });
  });

  describe('processAllChains', () => {
      beforeEach(async () => {
          await easService.initialize();
      });

      it('should process all chains', async () => {
          // Mock processChain for different chains
          jest.spyOn(easService, 'processChain')
              .mockImplementation(async (chain: string) => {
                  return chain === 'arbitrum' ? 5 : 2;
        });

      const result = await easService.processAllChains();

        expect(typeof result).toBe('object');
        expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });
});
