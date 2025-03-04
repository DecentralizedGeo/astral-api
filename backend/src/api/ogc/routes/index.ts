import { Router } from 'express';
import { OgcCoreController } from '../controllers/core.controller';
import { OgcFeaturesController } from '../controllers/features.controller';

// Create a router for OGC API Features
const ogcRouter = Router();

// Core OGC API endpoints
ogcRouter.get('/', OgcCoreController.getLandingPage);
ogcRouter.get('/conformance', OgcCoreController.getConformance);
ogcRouter.get('/collections', OgcCoreController.getCollections);
ogcRouter.get('/collections/:collectionId', OgcCoreController.getCollection);

// Features endpoints
ogcRouter.get('/collections/:collectionId/items', OgcFeaturesController.getFeatures);
ogcRouter.get('/collections/:collectionId/items/:featureId', OgcFeaturesController.getFeature);

export { ogcRouter };