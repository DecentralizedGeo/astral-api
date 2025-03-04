import { Router } from 'express';
import { v0Router } from '../v0/routes';
import { syncRouter } from './sync.routes';
import { ogcRouter } from '../ogc/routes';
import handler from '../cron/sync';

// Create main API router
const apiRouter = Router();

// Connect v0 API routes
apiRouter.use('/v0', v0Router);

// Connect sync routes
apiRouter.use('/sync', syncRouter);

// Connect OGC API Features routes
apiRouter.use('/ogc', ogcRouter);

// Register cron endpoint for Vercel
apiRouter.post('/cron/sync', handler);

export { apiRouter };