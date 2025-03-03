/**
 * Interface representing the EAS Schema structure
 */
export interface EASSchema {
  eventTimestamp: string; // uint256
  srs: string;
  locationType: string;
  location: string;
  recipeType: string[];
  recipePayload: string[]; // bytes[]
  mediaType: string[];
  mediaData: string[];
  memo: string;
}

/**
 * Interface representing a chain configuration
 */
export interface ChainConfig {
  chain: string;
  deploymentBlock: number;
  rpcUrl: string;
  easContractAddress: string;
  schemaUID: string;
}

/**
 * The location proof data stored in the database
 */
export interface LocationProof {
  uid: string;
  chain: string;
  prover: string;
  subject?: string;
  timestamp?: Date;
  event_timestamp: Date;
  srs?: string;
  location_type: string;
  location: string;
  longitude?: number;
  latitude?: number;
  geometry?: any; // PostGIS geometry
  recipe_types?: string[];
  recipe_payloads?: string[];
  media_types?: string[];
  media_data?: string[];
  memo?: string;
  revoked: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Parameters for querying location proofs
 */
export interface LocationProofQueryParams {
  chain?: string;
  prover?: string;
  subject?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  limit?: number;
  offset?: number;
}

/**
 * GeoJSON geometry types
 */
export enum GeoJSONGeometryType {
  Point = 'Point',
  LineString = 'LineString',
  Polygon = 'Polygon',
  MultiPoint = 'MultiPoint',
  MultiLineString = 'MultiLineString',
  MultiPolygon = 'MultiPolygon',
  GeometryCollection = 'GeometryCollection'
}

/**
 * GeoJSON Point geometry
 */
export interface GeoJSONPoint {
  type: GeoJSONGeometryType.Point;
  coordinates: [number, number] | [number, number, number]; // [longitude, latitude] or [longitude, latitude, altitude]
}

/**
 * Basic GeoJSON Feature representation
 */
export interface GeoJSONFeature<T = any> {
  type: 'Feature';
  geometry: GeoJSONPoint | null;
  properties: T;
  id?: string;
}

/**
 * GeoJSON FeatureCollection representation
 */
export interface GeoJSONFeatureCollection<T = any> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<T>[];
  links: {
    rel: string;
    href: string;
    type: string;
  }[];
}