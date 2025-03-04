import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { apiRouter } from './api/routes';
import { logger } from './utils/logger';
import { config } from './config';
import { supabaseService } from './services/supabase.service';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT || '3001'); // Use different port to avoid conflicts

// Initialize Supabase client if credentials are provided
try {
  const client = supabaseService.initialize();
  if (client) {
    logger.info('Supabase client initialized successfully');
  } else {
    logger.warn('Supabase client could not be initialized due to missing credentials');
  }
} catch (error) {
  logger.error('Supabase client initialization error:', error);
  logger.warn('Continuing without Supabase integration - OGC API endpoints may not work correctly');
}

// Middleware
app.use(express.json());
app.use(cors());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Astral API is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    title: 'Astral Protocol Location Proof API',
    description: 'API for querying location proof attestations across multiple blockchains',
    version: 'v0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      config: '/api/v0/config',
      locationProofs: '/api/v0/location-proofs',
      locationProofsStats: '/api/v0/location-proofs/stats',
      syncStatus: '/api/sync/status',
      triggerSync: '/api/sync',
      ogcApi: '/api/ogc'
    }
  });
});

// Connect API routes
app.use('/api', apiRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server if not running in a serverless environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === undefined) {
  const server = app.listen(port, () => {
    const actualPort = (server.address() as any).port;
    logger.info(`Server running at http://localhost:${actualPort}`);
  });
}

// Export for serverless environments like Vercel
export default app;