import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';
import { requireBearerToken } from '../middleware/auth';

// Create a new router for sync
const syncRouter = Router();

// Mutating sync routes require `Authorization: Bearer $SYNC_ADMIN_TOKEN`
const requireAdmin = requireBearerToken('SYNC_ADMIN_TOKEN');

// Get sync status (public, read-only)
syncRouter.get('/status', SyncController.getStatus);

// Conditionally register sync trigger endpoint (set DISABLE_SYNC_TRIGGER=true to remove it)
const disableSyncTrigger = process.env.DISABLE_SYNC_TRIGGER === 'true';
if (!disableSyncTrigger) {
  syncRouter.post('/', requireAdmin, SyncController.triggerSync);
}

// Trigger revocation check
syncRouter.post('/revocations', requireAdmin, SyncController.triggerRevocationCheck);

// Control the background worker
syncRouter.post('/worker', requireAdmin, SyncController.controlWorker);

export { syncRouter };
