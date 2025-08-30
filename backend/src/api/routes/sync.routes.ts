import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';

// Create a new router for sync
const syncRouter = Router();

// Get sync status
syncRouter.get('/status', SyncController.getStatus);

// Conditionally register sync trigger endpoint
const disableSyncTrigger = process.env.DISABLE_SYNC_TRIGGER === 'false';
if (!disableSyncTrigger) {
    syncRouter.post('/', SyncController.triggerSync);
}

// Trigger revocation check
syncRouter.post('/revocations', SyncController.triggerRevocationCheck);

// Control the background worker
syncRouter.post('/worker', SyncController.controlWorker);

export { syncRouter };