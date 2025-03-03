import { Request, Response } from 'express';
import { easEndpoints, config } from '../../../config';
import { logger } from '../../../utils/logger';

/**
 * Controller for API configuration endpoints
 */
export class ConfigController {
  /**
   * Get API configuration including available chains and their endpoints
   * 
   * @param req Express request
   * @param res Express response
   */
  static getConfig(req: Request, res: Response) {
    try {
      // Create a cleaned config object with only the needed information
      const configResponse = {
        chains: {
          arbitrum: !!easEndpoints.arbitrum,
          celo: !!easEndpoints.celo,
          sepolia: !!easEndpoints.sepolia,
          base: !!easEndpoints.base,
        },
        schema: config.EAS_SCHEMA_UID,
        schema_fields: config.EAS_SCHEMA_RAW_STRING || undefined,
        version: 'v0',
      };
      
      return res.status(200).json(configResponse);
    } catch (error) {
      logger.error('Error getting config:', error);
      return res.status(500).json({ error: 'Failed to get configuration' });
    }
  }
}