---
id: api-reference
title: Astral API Reference
sidebar_label: API Reference
slug: /api-reference
---

# Astral API Reference

The Astral Protocol API provides access to location proof attestations from multiple blockchains. This document covers all available endpoints, request parameters, and response formats.

## Base URL

The base URL for all API endpoints is:

```
https://api.astral.global
```

## Authentication

The API currently does not require authentication for read operations. Future versions may implement authentication for permissioned read and write operations.

## Content Type

All requests and responses use JSON format. Include the following header in your requests:

```
Content-Type: application/json
```

## Endpoints

### Health Check

```
GET /health
```

Checks if the API is running.

#### Response

```json
{
  "status": "ok",
  "message": "Astral API is running"
}
```

### API Root

```
GET /
```

Returns basic information about the API and available endpoints.

#### Response

```json
{
  "title": "Astral Protocol Location Proof API",
  "description": "API for querying location proof attestations across multiple blockchains",
  "version": "v0",
  "links": [
    {
      "rel": "self",
      "href": "/",
      "type": "application/json"
    },
    {
      "rel": "api",
      "href": "/api/v0",
      "type": "application/json"
    },
    {
      "rel": "config",
      "href": "/api/v0/config",
      "type": "application/json"
    },
    {
      "rel": "sync",
      "href": "/api/sync",
      "type": "application/json"
    },
    {
      "rel": "location-proofs",
      "href": "/api/v0/location-proofs",
      "type": "application/json"
    }
  ]
}
```

### Get Configuration

```
GET /api/v0/config
```

Returns the API configuration including supported chains and EAS schema information.

#### Response

```json
{
  "chains": {
    "arbitrum": true,
    "celo": true,
    "sepolia": true,
    "base": true
  },
  "schema": "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2",
  "schema_fields": "uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo",
  "version": "v0"
}
```

### Get Location Proofs

```
GET /api/v0/location-proofs
```

Returns a list of location proofs based on the provided query parameters.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Filter by blockchain (arbitrum, celo, sepolia, base) |
| `prover` | string | Filter by the address that created the proof |
| `subject` | string | Filter by the subject address |
| `fromTimestamp` | ISO date string | Filter proofs after this timestamp |
| `toTimestamp` | ISO date string | Filter proofs before this timestamp |
| `bbox` | array | Bounding box in format `[minLng, minLat, maxLng, maxLat]` |
| `limit` | number | Maximum number of results to return (default: 100) |
| `offset` | number | Pagination offset |

#### Response

```json
{
  "data": [
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
      "recipe_payloads": ["...", "..."],
      "media_types": ["image/jpeg"],
      "media_data": ["..."],
      "memo": "San Francisco city center",
      "revoked": false,
      "created_at": "2023-09-15T12:35:00Z",
      "updated_at": "2023-09-15T12:35:00Z"
    }
    // ... more location proofs
  ],
  "count": 1,
  "limit": 100,
  "offset": 0
}
```

### Get Location Proof by UID

```
GET /api/v0/location-proofs/:uid
```

Returns a specific location proof by its unique identifier (UID).

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | The unique identifier of the location proof |

#### Response

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
  "recipe_payloads": ["...", "..."],
  "media_types": ["image/jpeg"],
  "media_data": ["..."],
  "memo": "San Francisco city center",
  "revoked": false,
  "created_at": "2023-09-15T12:35:00Z",
  "updated_at": "2023-09-15T12:35:00Z"
}
```

### Get Location Proofs Statistics

```
GET /api/v0/location-proofs/stats
```

Returns statistics about location proofs in the database.

#### Response

```json
{
  "total": 1250,
  "by_chain": {
    "arbitrum": 320,
    "celo": 180,
    "sepolia": 450,
    "base": 300
  },
  "by_time": {
    "last_24_hours": 50,
    "last_7_days": 210,
    "last_30_days": 480
  },
  "revoked": 15
}
```

### Trigger Sync

```
POST /api/sync
```

Triggers a synchronization of attestations from EAS for all chains or a specific chain.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Optional. Sync only a specific chain (arbitrum, celo, sepolia, base) |

#### Response (All Chains)

```json
{
  "status": "success",
  "message": "Full sync cycle started"
}
```

#### Response (Specific Chain)

```json
{
  "status": "success",
  "message": "Successfully synced 25 attestations from sepolia",
  "chain": "sepolia",
  "count": 25
}
```

### Get Sync Status

```
GET /api/sync/status
```

Returns the current status of the synchronization process.

#### Response

```json
{
  "status": "ok",
  "worker": {
    "running": true,
    "isAttestationSyncRunning": false,
    "isRevocationCheckRunning": false,
    "startTime": "2023-09-15T10:00:00Z",
    "uptime": 7200,
    "lastSuccessfulRun": "2023-09-15T12:00:00Z",
    "lastRunDuration": "25.30s",
    "totalRuns": 12,
    "successfulRuns": 11,
    "failedRuns": 1
  },
  "attestations": {
    "totalIngested": 1250,
    "byChain": {
      "arbitrum": 320,
      "celo": 180,
      "sepolia": 450,
      "base": 300
    },
    "lastRunIngested": {
      "arbitrum": 5,
      "celo": 2,
      "sepolia": 8,
      "base": 10
    }
  },
  "revocationChecks": {
    "lastRun": "2023-09-15T11:30:00Z",
    "totalChecked": 1000,
    "totalRevoked": 15
  },
  "supportedChains": ["arbitrum", "base", "celo", "sepolia"],
  "recentErrors": [
    {
      "timestamp": "2023-09-15T11:15:00Z",
      "message": "Network timeout for GraphQL request",
      "chain": "arbitrum"
    }
  ]
}
```

### Trigger Revocation Check

```
POST /api/sync/revocations
```

Triggers a check for revocations of existing attestations.

#### Response

```json
{
  "status": "success",
  "message": "Revocation check started"
}
```

### Control Worker

```
POST /api/sync/worker
```

Controls the background worker that performs synchronization.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | The action to perform (`start` or `stop`) |

#### Response (Start)

```json
{
  "status": "success",
  "message": "Background worker started"
}
```

#### Response (Stop)

```json
{
  "status": "success",
  "message": "Background worker stopped"
}
```

## Error Responses

All API endpoints return appropriate HTTP status codes and error messages in case of failures.

### Example Error Response

```json
{
  "status": "error",
  "message": "Failed to get sync status",
  "error": "Database connection error"
}
```

### Common Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request was successful |
| 202 | Accepted - The request has been accepted for processing |
| 400 | Bad Request - The request was invalid |
| 404 | Not Found - The requested resource was not found |
| 409 | Conflict - The request couldn't be processed due to a conflict |
| 500 | Internal Server Error - Something went wrong on the server |

## Rate Limiting

The API currently does not implement rate limiting, but users should be mindful of their request frequency to ensure optimal performance for all users.

## Pagination

The API supports pagination through the `limit` and `offset` parameters for endpoints that return collections.

Example: 
```
GET /api/v0/location-proofs?limit=20&offset=40
```

This will return 20 location proofs starting from the 41st record.