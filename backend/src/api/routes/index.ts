import { Router } from 'express';
import { v0Router } from '../v0/routes';
import { syncRouter } from './sync.routes';

// Create main API router
const apiRouter = Router();

// Connect v0 API routes
apiRouter.use('/v0', v0Router);

// Connect sync routes
apiRouter.use('/sync', syncRouter);

export { apiRouter };