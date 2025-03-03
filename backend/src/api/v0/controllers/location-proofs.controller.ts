import { Request, Response } from 'express';
import { LocationProofQueryParams } from '../../../models/types';
import { supabaseService } from '../../../services/supabase.service';
import { logger } from '../../../utils/logger';

/**
 * Controller for location proofs endpoints
 */
export class LocationProofsController {
  /**
   * Get a location proof by its UID
   * 
   * @param req Express request
   * @param res Express response
   */
  static async getLocationProofByUid(req: Request, res: Response) {
    try {
      const { uid } = req.params;
      
      if (!uid) {
        return res.status(400).json({ error: 'UID is required' });
      }
      
      const locationProof = await supabaseService.getLocationProofByUid(uid);
      
      if (!locationProof) {
        return res.status(404).json({ error: 'Location proof not found' });
      }
      
      return res.status(200).json(locationProof);
    } catch (error) {
      logger.error('Error getting location proof:', error);
      return res.status(500).json({ error: 'Failed to get location proof' });
    }
  }
  
  /**
   * Query location proofs with filters
   * 
   * @param req Express request
   * @param res Express response
   */
  static async queryLocationProofs(req: Request, res: Response) {
    try {
      // Parse query parameters
      const params: LocationProofQueryParams = {};
      
      if (req.query.chain) {
        params.chain = req.query.chain as string;
      }
      
      if (req.query.prover) {
        params.prover = req.query.prover as string;
      }
      
      if (req.query.subject) {
        params.subject = req.query.subject as string;
      }
      
      if (req.query.fromTimestamp) {
        params.fromTimestamp = new Date(req.query.fromTimestamp as string);
      }
      
      if (req.query.toTimestamp) {
        params.toTimestamp = new Date(req.query.toTimestamp as string);
      }
      
      if (req.query.bbox) {
        const bboxString = req.query.bbox as string;
        const bboxValues = bboxString.split(',').map(Number);
        
        if (bboxValues.length === 4 && !bboxValues.some(isNaN)) {
          params.bbox = bboxValues as [number, number, number, number];
        } else {
          return res.status(400).json({ error: 'Invalid bbox format. Expected "minLon,minLat,maxLon,maxLat"' });
        }
      }
      
      // Parse pagination parameters
      if (req.query.limit) {
        const limit = parseInt(req.query.limit as string, 10);
        
        if (!isNaN(limit) && limit > 0) {
          params.limit = Math.min(limit, 100); // Cap at 100 results
        }
      }
      
      if (req.query.offset) {
        const offset = parseInt(req.query.offset as string, 10);
        
        if (!isNaN(offset) && offset >= 0) {
          params.offset = offset;
        }
      }
      
      // Get total count for pagination
      const total = await supabaseService.getLocationProofsCount(params);
      
      // Get location proofs
      const locationProofs = await supabaseService.queryLocationProofs(params);
      
      // Build response with pagination details
      const response = {
        data: locationProofs,
        pagination: {
          total,
          limit: params.limit || 20,
          offset: params.offset || 0,
          next: total > (params.offset || 0) + (params.limit || 20) ? 
            `/api/v0/location-proofs?${new URLSearchParams({
              ...req.query as Record<string, string>,
              offset: ((params.offset || 0) + (params.limit || 20)).toString(),
            })}` : 
            null,
        },
      };
      
      return res.status(200).json(response);
    } catch (error) {
      logger.error('Error querying location proofs:', error);
      return res.status(500).json({ error: 'Failed to query location proofs' });
    }
  }
  
  /**
   * Get aggregate stats for location proofs
   * 
   * @param req Express request
   * @param res Express response
   */
  static async getLocationProofsStats(req: Request, res: Response) {
    try {
      // Get total count
      const total = await supabaseService.getLocationProofsCount();
      
      // Get counts by chain
      const chains = ['arbitrum', 'celo', 'sepolia', 'base'];
      const chainCounts: Record<string, number> = {};
      
      for (const chain of chains) {
        chainCounts[chain] = await supabaseService.getLocationProofsCount({ chain });
      }
      
      return res.status(200).json({
        total,
        by_chain: chainCounts,
      });
    } catch (error) {
      logger.error('Error getting location proofs stats:', error);
      return res.status(500).json({ error: 'Failed to get location proofs stats' });
    }
  }
}