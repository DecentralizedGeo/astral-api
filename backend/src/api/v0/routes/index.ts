import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { locationProofsRouter } from './location-proofs.routes';

// Create a new router for v0 API
const v0Router = Router();

// Config route
v0Router.get('/config', ConfigController.getConfig);

// Connect location proofs routes
v0Router.use('/location-proofs', locationProofsRouter);

export { v0Router };