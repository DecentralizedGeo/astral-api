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
    
    // Initialize the worker
    const worker = new EasWorker();
    await worker.initialize();
    
    // Process all chains
    const results = await worker.runIngestion();
    
    // Check for revocations
    await worker.checkRevocations();
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'EAS sync completed successfully',
    });
  } catch (error) {
    logger.error('Error in cron job:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to run EAS sync',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}