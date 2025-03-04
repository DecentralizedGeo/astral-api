/**
 * TypeScript interfaces for GraphQL types
 * Provides type safety for resolvers and data transformation
 */

export interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

export interface LocationProofGraphQL {
  uid: string;
  chain: string;
  prover: string;
  subject?: string | null;
  timestamp?: string | null;
  eventTimestamp: string;
  srs?: string | null;
  locationType: string;
  location: string;
  longitude?: number | null;
  latitude?: number | null;
  geometry?: GeoJSONGeometry | null;
  recipeTypes?: string[] | null;
  recipePayloads?: string[] | null;
  mediaTypes?: string[] | null;
  mediaData?: string[] | null;
  memo?: string | null;
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationProofFilter {
  chain?: string;
  prover?: string;
  subject?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  limit?: number;
  offset?: number;
}

export interface ChainCount {
  chain: string;
  count: number;
}

export interface LocationProofStats {
  total: number;
  byChain: ChainCount[];
}

export interface GraphQLContext {
  dataSources: {
    supabaseService: any;
  };
}