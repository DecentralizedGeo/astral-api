import { Request, Response } from 'express';
import { supabaseService } from '../../../services/supabase.service';
import { logger } from '../../../utils/logger';
import { z } from 'zod';
import { LocationProof } from '../../../models/types';

// GeoJSON geometry types
interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

// GeoJSON features
interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSONGeometry | null;
  properties: Record<string, any>;
  links?: {
    href: string;
    rel: string;
    type: string;
    title: string;
  }[];
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  links: {
    href: string;
    rel: string;
    type: string;
    title: string;
  }[];
  timeStamp: string;
  numberMatched: number;
  numberReturned: number;
}

/**
 * OGC Features controller
 * Manages the GeoJSON features endpoints for the OGC API
 */
export class OgcFeaturesController {
  /**
   * Get features from a collection
   * @param req Express request
   * @param res Express response
   */
  static async getFeatures(req: Request, res: Response) {
    try {
      const collectionId = req.params.collectionId;
      
      // For now we only support location-proofs
      if (collectionId !== 'location-proofs') {
        return res.status(404).json({
          title: "Not Found",
          detail: `Collection '${collectionId}' not found`
        });
      }
      
      // Parse query parameters
      const queryParams = parseQueryParams(req);
      
      // Get base URL for link construction
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const ogcPath = `/ogc/collections/${collectionId}/items`;
      
      // Set proper content-type for GeoJSON
      res.setHeader('Content-Type', 'application/geo+json');
      
      // Get features from database
      const result = await getLocationProofsAsFeatures(
        queryParams.bbox,
        queryParams.datetime ? {
          fromTimestamp: queryParams.datetime.start,
          toTimestamp: queryParams.datetime.end
        } : undefined,
        queryParams.limit,
        queryParams.offset,
        queryParams.chain,
        queryParams.prover
      );
      
      // Build next/prev links for pagination
      const links = [
        {
          href: `${baseUrl}${ogcPath}?${new URLSearchParams(req.query as Record<string, string>).toString()}`,
          rel: "self",
          type: "application/geo+json",
          title: "This document"
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: "collection",
          type: "application/json",
          title: "The collection document"
        }
      ];
      
      // Add next link if more results are available
      if (result.features.length === queryParams.limit) {
        const nextOffset = queryParams.offset + queryParams.limit;
        const nextQuery = new URLSearchParams({
          ...req.query as Record<string, string>,
          offset: nextOffset.toString()
        }).toString();
        
        links.push({
          href: `${baseUrl}${ogcPath}?${nextQuery}`,
          rel: "next",
          type: "application/geo+json",
          title: "Next page"
        });
      }
      
      // Add prev link if not on the first page
      if (queryParams.offset > 0) {
        const prevOffset = Math.max(0, queryParams.offset - queryParams.limit);
        const prevQuery = new URLSearchParams({
          ...req.query as Record<string, string>,
          offset: prevOffset.toString()
        }).toString();
        
        links.push({
          href: `${baseUrl}${ogcPath}?${prevQuery}`,
          rel: "prev",
          type: "application/geo+json",
          title: "Previous page"
        });
      }
      
      // Construct the GeoJSON response following OGC API Features requirements
      const response: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: result.features,
        links: links,
        timeStamp: new Date().toISOString(),
        numberMatched: result.count,
        numberReturned: result.features.length
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error getting OGC features:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to retrieve features"
      });
    }
  }

  /**
   * Get a single feature by ID
   * @param req Express request
   * @param res Express response
   */
  static async getFeature(req: Request, res: Response) {
    try {
      const collectionId = req.params.collectionId;
      const featureId = req.params.featureId;
      
      // For now we only support location-proofs
      if (collectionId !== 'location-proofs') {
        return res.status(404).json({
          title: "Not Found",
          detail: `Collection '${collectionId}' not found`
        });
      }
      
      // Set proper content-type for GeoJSON
      res.setHeader('Content-Type', 'application/geo+json');
      
      // Get the Supabase client
      const client = supabaseService.getClient();
      if (!client) {
        throw new Error('Supabase client not available');
      }
      
      // Fetch the location proof by UID
      const { data, error } = await client
        .from('location_proofs')
        .select('*')
        .eq('uid', featureId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return res.status(404).json({
            title: "Not Found",
            detail: `Feature with ID '${featureId}' not found`
          });
        }
        throw error;
      }
      
      // Convert to GeoJSON feature
      const feature = locationProofToGeoJSONFeature(data as LocationProof);
      
      // Get base URL for link construction
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Add links
      feature.links = [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items/${featureId}`,
          rel: "self",
          type: "application/geo+json",
          title: "This document"
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: "collection",
          type: "application/json",
          title: "The collection document"
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items`,
          rel: "collection",
          type: "application/geo+json",
          title: "All features in the collection"
        }
      ];
      
      res.json(feature);
    } catch (error) {
      logger.error('Error getting OGC feature:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to retrieve feature"
      });
    }
  }
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(req: Request) {
  // Define schema for query parameters
  const querySchema = z.object({
    // Bounding box: minLon,minLat,maxLon,maxLat
    bbox: z.string().optional().transform(val => {
      if (!val) return undefined;
      
      const coords = val.split(',').map(Number);
      if (coords.length !== 4 || coords.some(isNaN)) {
        throw new Error('Invalid bbox format. Use: minLon,minLat,maxLon,maxLat');
      }
      
      return coords as [number, number, number, number];
    }),
    
    // Datetime filter: instant, interval, or open-ended interval
    datetime: z.string().optional().transform(val => {
      if (!val) return undefined;
      
      // Handle ISO date format or intervals
      if (val.includes('/')) {
        const [start, end] = val.split('/');
        return {
          start: start === '..' ? undefined : new Date(start),
          end: end === '..' ? undefined : new Date(end)
        };
      } else {
        // Single date
        const date = new Date(val);
        return {
          start: date,
          end: date
        };
      }
    }),
    
    // Pagination parameters
    limit: z.string().optional()
      .transform(val => val ? parseInt(val, 10) : 10)
      .refine(val => val > 0 && val <= 1000, {
        message: 'Limit must be between 1 and 1000'
      }),
    
    offset: z.string().optional()
      .transform(val => val ? parseInt(val, 10) : 0)
      .refine(val => val >= 0, {
        message: 'Offset must be non-negative'
      }),
    
    // Additional filters for location proofs
    chain: z.string().optional(),
    prover: z.string().optional()
  });
  
  // Parse and validate
  const result = querySchema.safeParse(req.query);
  
  if (!result.success) {
    // Log validation errors
    logger.warn('Query parameter validation errors:', result.error.flatten());
    
    // Return default values for invalid parameters
    return {
      limit: 10,
      offset: 0,
      bbox: undefined,
      datetime: undefined,
      chain: undefined,
      prover: undefined
    };
  }
  
  return result.data;
}

/**
 * Convert a location proof to a GeoJSON feature
 */
function locationProofToGeoJSONFeature(proof: LocationProof): GeoJSONFeature {
  let geometry: GeoJSONGeometry | null = null;
  
  // If geometry data is available in a parseable form, use it
  if (proof.geometry) {
    // Convert PostGIS geometry to GeoJSON
    try {
      // Handle case where geometry might be a string representation
      if (typeof proof.geometry === 'string') {
        // Try to parse if it's a string representation of JSON
        try {
          const parsed = JSON.parse(proof.geometry);
          if (parsed && typeof parsed === 'object' && 'type' in parsed && 'coordinates' in parsed) {
            geometry = parsed as GeoJSONGeometry;
          }
        } catch (e) {
          // If it can't be parsed, use null geometry
          geometry = null;
        }
      } else if (proof.geometry && typeof proof.geometry === 'object' && 'type' in proof.geometry && 'coordinates' in proof.geometry) {
        // Assume it's already a GeoJSON object
        geometry = proof.geometry as GeoJSONGeometry;
      }
    } catch (e) {
      // In case of errors, fall back to coordinates
      logger.warn(`Failed to parse geometry for proof ${proof.uid}:`, e);
      geometry = null;
    }
  } 
  
  // Fall back to longitude/latitude if available
  if (!geometry && proof.longitude && proof.latitude) {
    // Create a point geometry from lon/lat
    geometry = {
      type: 'Point',
      coordinates: [proof.longitude, proof.latitude]
    };
  }
  
  // Build GeoJSON feature
  return {
    type: 'Feature',
    id: proof.uid,
    geometry: geometry,
    properties: {
      // Extract relevant properties from the proof
      chain: proof.chain,
      prover: proof.prover,
      subject: proof.subject,
      event_timestamp: proof.event_timestamp,
      location_type: proof.location_type,
      location: proof.location,
      srs: proof.srs,
      revoked: proof.revoked,
      // Include additional properties if available
      recipe_types: proof.recipe_types,
      recipe_payloads: proof.recipe_payloads,
      media_types: proof.media_types,
      media_data: proof.media_data,
      memo: proof.memo
    }
  };
}

/**
 * Get location proofs as GeoJSON features
 */
async function getLocationProofsAsFeatures(
  bbox?: [number, number, number, number],
  datetimeRange?: { fromTimestamp?: Date, toTimestamp?: Date },
  limit: number = 10,
  offset: number = 0,
  chain?: string,
  prover?: string
) {
  // Get the Supabase client
  const client = supabaseService.getClient();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  
  try {
    // Build query parameters for Supabase
    const queryParams: Record<string, any> = {
      limit,
      offset
    };
    
    if (chain) {
      queryParams.chain = chain;
    }
    
    if (prover) {
      queryParams.prover = prover;
    }
    
    if (datetimeRange?.fromTimestamp) {
      queryParams.fromTimestamp = datetimeRange.fromTimestamp;
    }
    
    if (datetimeRange?.toTimestamp) {
      queryParams.toTimestamp = datetimeRange.toTimestamp;
    }
    
    if (bbox) {
      queryParams.bbox = bbox;
    }
    
    // Get location proofs using the Supabase service
    const proofs = await supabaseService.queryLocationProofs(queryParams);
    
    // Get total count (potentially filtered by the same criteria)
    const count = await supabaseService.getLocationProofsCount(queryParams);
    
    // Convert to GeoJSON features
    const features = proofs.map(locationProofToGeoJSONFeature);
    
    return {
      features,
      count
    };
  } catch (error) {
    logger.error('Error fetching location proofs:', error);
    throw error;
  }
}