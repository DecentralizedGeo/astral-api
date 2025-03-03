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
  supabaseService.initialize();
  logger.info('Supabase client initialized successfully');
} catch (error) {
  logger.warn('Supabase client could not be initialized, continuing without Supabase integration');
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
    links: [
      {
        rel: 'self',
        href: '/',
        type: 'application/json'
      },
      {
        rel: 'api',
        href: '/api/v0',
        type: 'application/json'
      },
      {
        rel: 'config',
        href: '/api/v0/config',
        type: 'application/json'
      },
      {
        rel: 'sync',
        href: '/api/sync',
        type: 'application/json'
      },
      {
        rel: 'location-proofs',
        href: '/api/v0/location-proofs',
        type: 'application/json'
      }
    ]
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