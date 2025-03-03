import { Router } from 'express';
import { LocationProofsController } from '../controllers/location-proofs.controller';

// Create a new router for location proofs
const locationProofsRouter = Router();

// Get statistics about location proofs (must come before /:uid to not match "stats" as a UID)
locationProofsRouter.get('/stats', LocationProofsController.getLocationProofsStats);

// Get all location proofs with filters
locationProofsRouter.get('/', LocationProofsController.queryLocationProofs);

// Get a specific location proof by UID (must come after other specific routes)
locationProofsRouter.get('/:uid', LocationProofsController.getLocationProofByUid);

export { locationProofsRouter };