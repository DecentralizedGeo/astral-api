# GraphQL API Documentation

This document describes the GraphQL API for accessing location proof attestations in the Astral Protocol API.

## Overview

The GraphQL API provides a flexible interface for querying location proofs with filtering, aggregation, and mutation capabilities. 

### Endpoint

The GraphQL API is available at:

```
/graphql
```

## Schema

The API provides the following main types and operations:

### Queries

#### `locationProof(uid: ID!): LocationProof`

Retrieves a single location proof by its unique identifier.

#### `locationProofs(filter: LocationProofFilter): [LocationProof!]!`

Retrieves a list of location proofs with optional filtering.

#### `locationProofsCount(filter: LocationProofFilter): Int!`

Returns the count of location proofs matching the filter criteria.

#### `locationProofsStats: LocationProofStats!`

Returns statistics about the location proofs, including counts by blockchain.

### Mutations

The GraphQL API is intentionally read-only. There are no mutations available to modify data.

### Types

#### `LocationProof`

Represents a location proof attestation.

```graphql
type LocationProof {
  uid: ID!
  chain: String!
  prover: String!
  subject: String
  timestamp: String
  eventTimestamp: String!
  srs: String
  locationType: String!
  location: String!
  longitude: Float
  latitude: Float
  geometry: GeoJSONGeometry
  recipeTypes: [String]
  recipePayloads: [String]
  mediaTypes: [String]
  mediaData: [String]
  memo: String
  revoked: Boolean!
  createdAt: String!
  updatedAt: String!
}
```

#### `GeoJSONGeometry`

Represents GeoJSON geometry data.

```graphql
type GeoJSONGeometry {
  type: String!
  coordinates: JSON!
}
```

#### `LocationProofFilter`

Input type for filtering location proofs.

```graphql
input LocationProofFilter {
  chain: String
  prover: String
  subject: String
  fromTimestamp: String
  toTimestamp: String
  bbox: [Float]
  limit: Int
  offset: Int
}
```

#### `LocationProofStats`

Statistics about location proofs.

```graphql
type LocationProofStats {
  total: Int!
  byChain: [ChainCount!]!
}

type ChainCount {
  chain: String!
  count: Int!
}
```

## Example Queries

### Get a single location proof

```graphql
query GetLocationProof {
  locationProof(uid: "0xa1d140a3243443eb10320d758235f633eb0db20a3374866f6f53001ac3fcd2c6") {
    uid
    chain
    prover
    eventTimestamp
    locationType
    longitude
    latitude
    geometry {
      type
      coordinates
    }
  }
}
```

### Get location proofs with filtering

```graphql
query GetLocationProofs {
  locationProofs(filter: {
    chain: "sepolia",
    limit: 5,
    offset: 0
  }) {
    uid
    chain
    prover
    eventTimestamp
    locationType
    revoked
  }
}
```

### Get location proofs with spatial filter

```graphql
query GetLocationProofsInArea {
  locationProofs(filter: {
    bbox: [-74.1, 40.6, -73.7, 40.9], # NYC area
    limit: 10
  }) {
    uid
    chain
    prover
    eventTimestamp
    location
    longitude
    latitude
  }
}
```

### Get location proof statistics

```graphql
query GetStats {
  locationProofsStats {
    total
    byChain {
      chain
      count
    }
  }
}
```

### Count location proofs by chain

```graphql
query CountByChain {
  arbitrum: locationProofsCount(filter: { chain: "arbitrum" })
  sepolia: locationProofsCount(filter: { chain: "sepolia" })
  base: locationProofsCount(filter: { chain: "base" })
}
```

<!-- Mutation examples removed as the API is read-only -->

## Integration with Client Applications

### JavaScript Example

```javascript
async function fetchLocationProofs() {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query GetRecentProofs {
          locationProofs(filter: { limit: 10 }) {
            uid
            chain
            prover
            eventTimestamp
            locationType
            location
            longitude
            latitude
          }
        }
      `,
    }),
  });

  const result = await response.json();
  return result.data.locationProofs;
}
```

## Tools

The GraphQL API includes introspection, allowing tools like [GraphQL Playground](https://github.com/graphql/graphql-playground) and [Apollo Studio Explorer](https://studio.apollographql.com/) to explore the schema and test queries.