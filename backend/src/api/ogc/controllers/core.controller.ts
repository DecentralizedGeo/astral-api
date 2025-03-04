import { Request, Response } from 'express';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';

/**
 * OGC API Features Core controller
 * Implements the core OGC API Features functionality (landing page, conformance, collections)
 */
export class OgcCoreController {
  /**
   * Landing page - provides links to API capabilities
   * @param req Express request
   * @param res Express response
   */
  static async getLandingPage(req: Request, res: Response) {
    try {
      // Get base URL for link construction
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const ogcPath = '/ogc';
      
      // Create landing page response following OGC API Features standard
      const response = {
        title: "Astral Protocol OGC API Features",
        description: "OGC API Features implementation for location proof attestations",
        links: [
          {
            href: `${baseUrl}${ogcPath}`,
            rel: "self",
            type: "application/json",
            title: "This document"
          },
          {
            href: `${baseUrl}${ogcPath}/conformance`,
            rel: "conformance",
            type: "application/json",
            title: "OGC API Features conformance classes implemented by this server"
          },
          {
            href: `${baseUrl}${ogcPath}/collections`,
            rel: "data",
            type: "application/json",
            title: "Information about feature collections"
          },
          {
            href: `${baseUrl}/api/v0/location-proofs`,
            rel: "alternate",
            type: "application/json",
            title: "Astral Protocol location proofs API (non-OGC)"
          }
        ],
        // Include API provider information
        serviceProvider: {
          name: "Astral Protocol",
          url: "https://astral.global"
        },
        // Additional metadata
        version: "1.0.0",
        timestamp: new Date().toISOString()
      };
      
      // Return as JSON
      res.json(response);
    } catch (error) {
      logger.error('Error generating OGC landing page:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to generate OGC API landing page"
      });
    }
  }

  /**
   * Conformance declaration - lists the conformance classes that the API conforms to
   * @param req Express request
   * @param res Express response
   */
  static async getConformance(req: Request, res: Response) {
    try {
      // Define which conformance classes our API implements
      // These URIs are standardized by OGC
      const response = {
        conformsTo: [
          // Core conformance class - requires support for JSON, queryables
          "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core",
          // GeoJSON conformance class - requires GeoJSON encoding of features
          "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson",
          // HTML conformance class - not implemented yet
          // "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/html",
          // OpenAPI conformance class - not implemented yet
          // "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/oas30",
          // CRS conformance class - defines coordinate systems
          "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/crs"
        ]
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error generating OGC conformance declaration:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to generate OGC API conformance declaration"
      });
    }
  }

  /**
   * Collections list - provides metadata about available feature collections
   * @param req Express request
   * @param res Express response
   */
  static async getCollections(req: Request, res: Response) {
    try {
      // Get base URL for link construction
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const ogcPath = '/ogc';
      
      // Define our location proofs collection
      const collections = [
        {
          id: "location-proofs",
          title: "Location Proofs",
          description: "Blockchain-attested location proofs from multiple chains",
          links: [
            {
              href: `${baseUrl}${ogcPath}/collections/location-proofs`,
              rel: "self",
              type: "application/json",
              title: "Location Proofs collection"
            },
            {
              href: `${baseUrl}${ogcPath}/collections/location-proofs/items`,
              rel: "items",
              type: "application/geo+json",
              title: "Location Proofs features"
            }
          ],
          extent: {
            spatial: {
              // WGS84 coordinate system, full global extent
              bbox: [[-180, -90, 180, 90]],
              crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
            },
            // Temporal extent will be dynamic based on our data
            temporal: {
              interval: [
                // Will be filled dynamically based on actual data
                [null, null]
              ],
              trs: "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian"
            }
          },
          itemType: "feature",
          crs: [
            "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
          ],
          storageCrs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        }
      ];
      
      // Format response following OGC API Features standard
      const response = {
        links: [
          {
            href: `${baseUrl}${ogcPath}/collections`,
            rel: "self",
            type: "application/json",
            title: "Feature collections"
          },
          {
            href: `${baseUrl}${ogcPath}`,
            rel: "parent",
            type: "application/json",
            title: "API landing page"
          }
        ],
        collections: collections
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error generating OGC collections list:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to generate OGC API collections list"
      });
    }
  }

  /**
   * Collection details - provides metadata about a specific feature collection
   * @param req Express request
   * @param res Express response
   */
  static async getCollection(req: Request, res: Response) {
    try {
      const collectionId = req.params.collectionId;
      
      // For now we only support location-proofs
      if (collectionId !== 'location-proofs') {
        return res.status(404).json({
          title: "Not Found",
          detail: `Collection '${collectionId}' not found`
        });
      }
      
      // Get base URL for link construction
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const ogcPath = '/ogc';
      
      // Define our location proofs collection
      const collection = {
        id: "location-proofs",
        title: "Location Proofs",
        description: "Blockchain-attested location proofs from multiple chains",
        links: [
          {
            href: `${baseUrl}${ogcPath}/collections/location-proofs`,
            rel: "self",
            type: "application/json",
            title: "Location Proofs collection"
          },
          {
            href: `${baseUrl}${ogcPath}/collections/location-proofs/items`,
            rel: "items",
            type: "application/geo+json",
            title: "Location Proofs features"
          },
          {
            href: `${baseUrl}${ogcPath}/collections`,
            rel: "parent",
            type: "application/json",
            title: "All collections"
          }
        ],
        extent: {
          spatial: {
            // WGS84 coordinate system, full global extent
            bbox: [[-180, -90, 180, 90]],
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
          },
          // Temporal extent will be dynamic based on our data
          temporal: {
            interval: [
              // Will be filled dynamically based on actual data
              [null, null]
            ],
            trs: "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian"
          }
        },
        itemType: "feature",
        crs: [
          "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        ],
        storageCrs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
      };
      
      res.json(collection);
    } catch (error) {
      logger.error('Error generating OGC collection details:', error);
      res.status(500).json({
        title: "Internal Server Error",
        detail: "Failed to generate OGC API collection details"
      });
    }
  }
}