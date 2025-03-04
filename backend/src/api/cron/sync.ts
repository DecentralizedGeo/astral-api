import { Request, Response } from 'express';
import { EasWorker } from '../../workers/eas-worker';
import { logger } from '../../utils/logger';

/**
 * Cron handler for Vercel to trigger the EAS sync process
 * This endpoint is called automatically by Vercel's cron scheduler
 */
export default async function handler(req: Request, res: Response) {
  // Only allow POST requests from Vercel
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logger.info('Cron job triggered for EAS sync');
    
    // Add detailed environment logging to help with debugging
    logger.info('Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set',
      easEndpointArbitrum: process.env.EAS_ENDPOINT_ARBITRUM ? 'Set' : 'Not set',
      easEndpointCelo: process.env.EAS_ENDPOINT_CELO ? 'Set' : 'Not set',
      easEndpointSepolia: process.env.EAS_ENDPOINT_SEPOLIA ? 'Set' : 'Not set',
      easEndpointBase: process.env.EAS_ENDPOINT_BASE ? 'Set' : 'Not set',
      easSchemaUid: process.env.EAS_SCHEMA_UID ? 'Set' : 'Not set'
    });
    
    // Initialize the worker with longer timeouts for Vercel environment
    logger.info('Initializing EAS worker for cron job');
    const worker = new EasWorker(
      60 * 1000, // 1 minute interval
      60 * 60 * 1000, // 1 hour revocation check
      5, // 5 retries
      10000 // 10 second retry delay
    );
    
    // Add more detailed logging during initialization
    try {
      logger.info('Starting worker initialization');
      await worker.initialize();
      logger.info('Worker initialization successful');
    } catch (initError) {
      logger.error('Worker initialization failed in cron job:', initError);
      throw initError;
    }
    
    // Process all chains with more detailed logging
    logger.info('Starting ingestion in cron job');
    const results = await worker.runIngestion()
      .catch(ingestionError => {
        logger.error('Ingestion failed in cron job:', ingestionError);
        throw ingestionError;
      });
    
    logger.info('Ingestion completed, checking revocations');
    
    // Check for revocations
    await worker.checkRevocations()
      .catch(revocationError => {
        // Log but don't fail the entire job
        logger.error('Revocation check failed in cron job:', revocationError);
      });
    
    // Return success
    logger.info('EAS sync cron job completed successfully');
    return res.status(200).json({
      success: true,
      message: 'EAS sync completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in cron job:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to run EAS sync',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}