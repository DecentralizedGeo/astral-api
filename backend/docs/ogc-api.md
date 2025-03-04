# OGC API Features Implementation

This document describes the OGC API Features implementation for the Astral Protocol Location Proof API.

## Overview

The OGC API Features standard defines a set of RESTful interfaces to access geospatial data following a standard approach. Our implementation allows accessing location proofs in GeoJSON format with spatial and temporal filtering capabilities.

## Endpoints

### Landing Page

```
GET /api/ogc
```

Returns links to the available resources and API capabilities.

### Conformance Declaration

```
GET /api/ogc/conformance
```

Lists the conformance classes that the API conforms to.

### Collections

```
GET /api/ogc/collections
```

Lists the available feature collections.

### Collection Details

```
GET /api/ogc/collections/{collectionId}
```

Returns detailed information about a specific feature collection.

### Features

```
GET /api/ogc/collections/{collectionId}/items
```

Returns features from the specified collection. Supports filtering and pagination.

### Single Feature

```
GET /api/ogc/collections/{collectionId}/items/{featureId}
```

Returns a specific feature from the collection.

## Query Parameters

The following query parameters are supported for the features endpoint:

### Core Parameters

- `limit`: Maximum number of features to return (default: 10, max: 1000)
- `offset`: Number of features to skip (for pagination)
- `bbox`: Bounding box filter in the format `minLon,minLat,maxLon,maxLat`
- `datetime`: Temporal filter, can be a specific time or a range:
  - Specific time: `2023-03-01T12:00:00Z`
  - Time range: `2023-03-01T00:00:00Z/2023-03-31T23:59:59Z`
  - Open-ended range: `../2023-03-31T23:59:59Z` or `2023-03-01T00:00:00Z/..`

### Additional Parameters

- `chain`: Filter by blockchain network (e.g. `arbitrum`, `base`, `sepolia`)
- `prover`: Filter by proof creator address

## Response Formats

All responses are in JSON format. Feature responses use the GeoJSON format with appropriate content-type headers.

### GeoJSON Features

Features are returned as GeoJSON objects with the following structure:

```json
{
  "type": "Feature",
  "id": "0x...",
  "geometry": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "properties": {
    "chain": "sepolia",
    "prover": "0x...",
    "subject": "0x...",
    "event_timestamp": "2023-03-01T12:00:00Z",
    "location_type": "DecimalDegrees<string>",
    "revoked": false,
    ...
  }
}
```

### GeoJSON Feature Collections

Feature collections are returned as GeoJSON FeatureCollection objects:

```json
{
  "type": "FeatureCollection",
  "features": [...],
  "links": [...],
  "timeStamp": "2023-03-28T15:23:45Z",
  "numberMatched": 100,
  "numberReturned": 10
}
```

## Example Requests

### Get all location proofs

```
GET /api/ogc/collections/location-proofs/items
```

### Get location proofs within a bounding box

```
GET /api/ogc/collections/location-proofs/items?bbox=-74.1,40.6,-73.7,40.9
```

### Get location proofs from a specific time range

```
GET /api/ogc/collections/location-proofs/items?datetime=2023-01-01T00:00:00Z/2023-12-31T23:59:59Z
```

### Get location proofs from a specific blockchain

```
GET /api/ogc/collections/location-proofs/items?chain=sepolia
```

### Combine multiple filters

```
GET /api/ogc/collections/location-proofs/items?chain=sepolia&bbox=-74.1,40.6,-73.7,40.9&limit=20&offset=40
```

## References

- [OGC API Features Specification](https://docs.ogc.org/is/17-069r4/17-069r4.html)
- [GeoJSON Format](https://geojson.org/)