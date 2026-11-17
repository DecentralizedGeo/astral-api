import { Request, Response } from 'express';
import { EasWorker } from '../../workers/eas-worker';
import { logger } from '../../utils/logger';

/**
 * Cron handler for Vercel to trigger the EAS sync process.
 *
 * Vercel Cron invokes the path with GET and `Authorization: Bearer $CRON_SECRET`.
 * It can also be triggered manually with GET or POST and the same header (or
 * the SYNC_ADMIN_TOKEN). Method and authentication are enforced by the router
 * in `api/routes/index.ts`, not here.
 */
export default async function handler(req: Request, res: Response) {
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
    
    logger.info('Ingestion completed successfully');
    
    // Reconcile revocation flags with EAS. Cost scales with the number of
    // revoked attestations (currently near zero), so it runs every invocation.
    // checkRevocations records per-chain errors itself; a failure here is
    // logged but does not fail the ingestion that already succeeded.
    await worker.checkRevocations()
      .catch(revocationError => {
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