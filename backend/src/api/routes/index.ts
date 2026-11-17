import { Router } from 'express';
import { v0Router } from '../v0/routes';
import { syncRouter } from './sync.routes';
import { ogcRouter } from '../ogc/routes';
import handler from '../cron/sync';
import { requireBearerToken } from '../middleware/auth';

// Create main API router
const apiRouter = Router();

// Connect v0 API routes
apiRouter.use('/v0', v0Router);

// Connect sync routes
apiRouter.use('/sync', syncRouter);

// Connect OGC API Features routes
apiRouter.use('/ogc', ogcRouter);

// Register cron endpoint for Vercel.
// Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`; POST is kept
// for manual triggers. SYNC_ADMIN_TOKEN is also accepted for manual use.
const requireCronAuth = requireBearerToken('CRON_SECRET', 'SYNC_ADMIN_TOKEN');
apiRouter.get('/cron/sync', requireCronAuth, handler);
apiRouter.post('/cron/sync', requireCronAuth, handler);

// Public endpoint for checking that the cron route is registered
apiRouter.get('/cron/sync/test', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Cron endpoint is properly registered',
    timestamp: new Date().toISOString(),
    instructions:
      'Send GET or POST to /api/cron/sync with "Authorization: Bearer <CRON_SECRET or SYNC_ADMIN_TOKEN>" to trigger sync manually'
  });
});

export { apiRouter };