---
id: data-model
title: Data Model
sidebar_label: Data Model
slug: /data-model
---

# Data Model

This document describes the data model used in the Astral Protocol API for location proofs.

## Location Proof

A location proof is an attestation about a geographic location, created by a prover and optionally referring to a subject. Each proof is stored on a blockchain using the Ethereum Attestation Service (EAS) and then indexed by the Astral API for easy querying.

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier of the attestation (UUID v4 format) |
| `chain` | string | Blockchain where the attestation is stored (e.g., "sepolia", "arbitrum") |
| `prover` | string | Ethereum address that created the attestation |
| `subject` | string | Optional Ethereum address that the attestation is about (if null, same as prover) |
| `timestamp` | ISO date | When the attestation was recorded on the blockchain |
| `event_timestamp` | ISO date | When the attested event actually occurred |
| `revoked` | boolean | Whether the attestation has been revoked by the prover |

### Location Data

| Field | Type | Description |
|-------|------|-------------|
| `srs` | string | Spatial reference system (typically "WGS84") |
| `location_type` | string | Type of location (e.g., "point", "polygon", "linestring") |
| `location` | string (GeoJSON) | Full GeoJSON representation of the location |
| `longitude` | number | Longitude coordinate (if available) |
| `latitude` | number | Latitude coordinate (if available) |
| `geometry` | PostGIS | Spatial geometry data (internal use) |

### Attestation Data

| Field | Type | Description |
|-------|------|-------------|
| `recipe_types` | string[] | Types of verification methods used (e.g., "gps", "ip", "wifi") |
| `recipe_payloads` | bytes[] | Raw verification data for each method |
| `media_types` | string[] | MIME types of attached media (e.g., "image/jpeg") |
| `media_data` | string[] | Base64-encoded media data |
| `memo` | string | Optional description or note about the location |

### Metadata

| Field | Type | Description |
|-------|------|-------------|
| `created_at` | ISO date | When the proof was added to the Astral database |
| `updated_at` | ISO date | When the proof was last updated in the database |

## JSON Representation

```json
{
  "uid": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "chain": "sepolia",
  "prover": "0xabcdef1234567890abcdef1234567890abcdef12",
  "subject": "0xabcdef1234567890abcdef1234567890abcdef12",
  "timestamp": "2023-09-15T12:34:56Z",
  "event_timestamp": "2023-09-15T12:34:56Z",
  "srs": "WGS84",
  "location_type": "point",
  "location": "{\"type\":\"Point\",\"coordinates\":[-122.4194,37.7749]}",
  "longitude": -122.4194,
  "latitude": 37.7749,
  "recipe_types": ["gps", "ip"],
  "recipe_payloads": ["0x1234...", "0x5678..."],
  "media_types": ["image/jpeg"],
  "media_data": ["base64_encoded_data..."],
  "memo": "San Francisco city center",
  "revoked": false,
  "created_at": "2023-09-15T12:35:00Z",
  "updated_at": "2023-09-15T12:35:00Z"
}
```

## EAS Schema

Location proofs use the following EAS schema:

```
uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo
```

Schema UID: `0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2`

## GeoJSON Formats

The `location` field uses GeoJSON format for representing spatial data. Supported GeoJSON types include:

### Point

```json
{
  "type": "Point",
  "coordinates": [-122.4194, 37.7749]
}
```

### LineString

```json
{
  "type": "LineString",
  "coordinates": [
    [-122.4194, 37.7749],
    [-122.4143, 37.7749],
    [-122.4098, 37.7837]
  ]
}
```

### Polygon

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [-122.4194, 37.7749],
      [-122.4143, 37.7749],
      [-122.4098, 37.7837],
      [-122.4194, 37.7837],
      [-122.4194, 37.7749]
    ]
  ]
}
```

### Feature

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "properties": {
    "name": "San Francisco"
  }
}
```

### FeatureCollection

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "name": "San Francisco"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-74.0060, 40.7128]
      },
      "properties": {
        "name": "New York"
      }
    }
  ]
}
```

## Recipe Types

The `recipe_types` field indicates how the location was verified. Common types include:

| Recipe Type | Description |
|------------|-------------|
| `gps` | GPS coordinates from a device |
| `ip` | Geolocation based on IP address |
| `wifi` | Location based on nearby WiFi networks |
| `cellular` | Location based on cellular towers |
| `manual` | Manually entered coordinates |
| `beacon` | Location derived from nearby beacons |
| `satellite` | Satellite-derived location data |
| `qrcode` | Location confirmed by scanning QR code |
| `nfc` | Location confirmed by NFC tag |

## Database Schema (PostgreSQL)

The API uses PostgreSQL with PostGIS for storing and querying location proofs:

```sql
CREATE TABLE location_proofs (
  uid VARCHAR PRIMARY KEY,
  chain VARCHAR NOT NULL,
  prover VARCHAR NOT NULL,
  subject VARCHAR,
  timestamp TIMESTAMPTZ,
  event_timestamp TIMESTAMPTZ NOT NULL,
  srs VARCHAR,
  location_type VARCHAR NOT NULL,
  location TEXT NOT NULL,
  longitude NUMERIC,
  latitude NUMERIC,
  recipe_types JSONB,
  recipe_payloads JSONB,
  media_types JSONB,
  media_data JSONB,
  memo TEXT,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add geometry column
SELECT AddGeometryColumn('public', 'location_proofs', 'geometry', 4326, 'GEOMETRY', 2);

-- Create indexes
CREATE INDEX idx_location_proofs_chain ON public.location_proofs(chain);
CREATE INDEX idx_location_proofs_prover ON public.location_proofs(prover);
CREATE INDEX idx_location_proofs_subject ON public.location_proofs(subject);
CREATE INDEX idx_location_proofs_timestamp ON public.location_proofs(event_timestamp);
CREATE INDEX idx_location_proofs_geometry ON public.location_proofs USING GIST(geometry);
```

## Query Parameters

When querying location proofs, the following parameters map to the data model:

| Parameter | Field | Example |
|-----------|-------|---------|
| `chain` | chain | `?chain=sepolia` |
| `prover` | prover | `?prover=0x1234...` |
| `subject` | subject | `?subject=0x5678...` |
| `fromTimestamp` | event_timestamp | `?fromTimestamp=2023-01-01T00:00:00Z` |
| `toTimestamp` | event_timestamp | `?toTimestamp=2023-12-31T23:59:59Z` |
| `bbox` | geometry | `?bbox=-122.5,37.7,-122.3,37.9` |

## Relationships

Location proofs have the following relationships:

1. **Chain** - Each proof is stored on exactly one blockchain
2. **Prover** - Each proof is created by exactly one Ethereum address
3. **Subject** - Each proof may optionally be about a specific Ethereum address
4. **Revocation** - A proof may be revoked by its prover

## Extensions

The data model may be extended in future versions to include:

1. **Verification Status** - Additional verification of the proof by third parties
2. **Confidence Level** - Measurement of location accuracy
3. **Temporal Validity** - Time range when the location proof is valid
4. **Environmental Conditions** - Weather, atmospheric conditions, etc.
5. **Chain of Custody** - Record of who has accessed or modified the proof

## Working with the Data Model

### TypeScript Interface

```typescript
interface LocationProof {
  uid: string;
  chain: string;
  prover: string;
  subject?: string;
  timestamp: Date;
  event_timestamp: Date;
  srs?: string;
  location_type: string;
  location: string;
  longitude?: number;
  latitude?: number;
  recipe_types?: string[];
  recipe_payloads?: string[];
  media_types?: string[];
  media_data?: string[];
  memo?: string;
  revoked: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LocationProofQueryParams {
  chain?: string;
  prover?: string;
  subject?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  limit?: number;
  offset?: number;
}
```

### Example: Parsing a Location Proof

```javascript
function parseLocationProof(data) {
  // Parse GeoJSON location
  let parsedLocation;
  try {
    parsedLocation = JSON.parse(data.location);
  } catch (e) {
    parsedLocation = null;
  }
  
  // Get coordinates from GeoJSON or direct fields
  let coordinates;
  if (parsedLocation && parsedLocation.type === 'Point') {
    coordinates = parsedLocation.coordinates;
  } else if (data.longitude !== null && data.latitude !== null) {
    coordinates = [data.longitude, data.latitude];
  } else {
    coordinates = null;
  }
  
  return {
    id: data.uid,
    location: {
      type: data.location_type,
      coordinates,
      full: parsedLocation
    },
    attestation: {
      chain: data.chain,
      prover: data.prover,
      subject: data.subject || data.prover,
      timestamp: new Date(data.event_timestamp),
      revoked: data.revoked
    },
    metadata: {
      recipes: data.recipe_types || [],
      media: data.media_types || [],
      memo: data.memo || ""
    }
  };
}
```