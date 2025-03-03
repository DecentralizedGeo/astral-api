import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';

// Create a new router for sync
const syncRouter = Router();

// Get sync status
syncRouter.get('/status', SyncController.getStatus);

// Trigger sync (can be used with ?chain=xxx query param)
syncRouter.post('/', SyncController.triggerSync);

// Trigger revocation check
syncRouter.post('/revocations', SyncController.triggerRevocationCheck);

// Control the background worker
syncRouter.post('/worker', SyncController.controlWorker);

export { syncRouter };