import { gql } from 'graphql-tag';

/**
 * GraphQL Schema for Astral Protocol API
 * Defines types and operations for location proofs
 */
export const typeDefs = gql`
  "Root Query type defining all available queries"
  type Query {
    "Get a single location proof by its unique identifier"
    locationProof(uid: ID!): LocationProof
    
    "Get a list of location proofs with optional filtering"
    locationProofs(filter: LocationProofFilter): [LocationProof!]!
    
    "Get the total count of location proofs matching a filter"
    locationProofsCount(filter: LocationProofFilter): Int!
    
    "Get statistics about location proofs per chain"
    locationProofsStats: LocationProofStats!
  }

  # Mutations have been intentionally removed to make the API read-only

  "Statistics about location proofs"
  type LocationProofStats {
    "Total count of location proofs"
    total: Int!
    
    "Counts by blockchain network"
    byChain: [ChainCount!]!
  }

  "Count of location proofs for a specific blockchain"
  type ChainCount {
    "Blockchain network identifier"
    chain: String!
    
    "Number of location proofs on this chain"
    count: Int!
  }

  "Location proof attestation with geospatial data"
  type LocationProof {
    "Unique identifier (hash) of the attestation"
    uid: ID!
    
    "Blockchain network where the attestation exists"
    chain: String!
    
    "Address of the entity creating the attestation"
    prover: String!
    
    "Optional address of the entity the attestation is about"
    subject: String
    
    "Timestamp when the attestation was recorded on-chain"
    timestamp: String
    
    "Timestamp of the actual event being attested to"
    eventTimestamp: String!
    
    "Spatial reference system identifier"
    srs: String
    
    "Type of location data (Point, LineString, etc.)"
    locationType: String!
    
    "Text representation of the location"
    location: String!
    
    "Longitude coordinate for point locations"
    longitude: Float
    
    "Latitude coordinate for point locations"
    latitude: Float
    
    "GeoJSON geometry object"
    geometry: GeoJSONGeometry
    
    "Types of proof recipes used"
    recipeTypes: [String]
    
    "Payloads of the proof recipes"
    recipePayloads: [String]
    
    "Types of media included with the attestation"
    mediaTypes: [String]
    
    "Data for the media included with the attestation"
    mediaData: [String]
    
    "Optional memo or note attached to the attestation"
    memo: String
    
    "Whether the attestation has been revoked"
    revoked: Boolean!
    
    "When the record was created in the database"
    createdAt: String!
    
    "When the record was last updated in the database"
    updatedAt: String!
  }

  "GeoJSON geometry object"
  type GeoJSONGeometry {
    "Type of geometry (Point, LineString, Polygon, etc.)"
    type: String!
    
    "Coordinates array matching the geometry type"
    coordinates: JSON!
  }

  "Filter parameters for location proofs queries"
  input LocationProofFilter {
    "Filter by blockchain network"
    chain: String
    
    "Filter by prover address"
    prover: String
    
    "Filter by subject address"
    subject: String
    
    "Filter by event timestamp (starting from)"
    fromTimestamp: String
    
    "Filter by event timestamp (ending at)"
    toTimestamp: String
    
    "Bounding box filter [minLon, minLat, maxLon, maxLat]"
    bbox: [Float]
    
    "Maximum number of results to return"
    limit: Int
    
    "Number of results to skip (for pagination)"
    offset: Int
  }

  "Custom scalar for handling JSON data"
  scalar JSON
`;

export default typeDefs;