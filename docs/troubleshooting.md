---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
slug: /troubleshooting
---

# Troubleshooting Guide

This guide helps you troubleshoot common issues when using the Astral API.

## Common API Errors

### 1. Unable to Connect to the API

**Symptoms:**
- Request timeout
- Connection refused
- Unable to resolve host

**Possible Causes:**
- API service may be down
- Network connectivity issues
- Incorrect API URL

**Solutions:**
- Check the API status at `https://api.astral.global/health`
- Verify your internet connection
- Ensure you're using the correct API URL
- Try again later if the service is experiencing downtime

### 2. 404 Not Found Errors

**Symptoms:**
- Response with status code 404
- Error message: `Cannot GET /path`

**Possible Causes:**
- Incorrect endpoint URL
- Endpoint does not exist
- API version mismatch

**Solutions:**
- Double-check the endpoint URL in the [API Reference](./api-reference.md)
- Ensure you're using the correct API version (v0)
- Check for typos in the URL path

Example of a correct endpoint:
```
https://api.astral.global/api/v0/location-proofs
```

### 3. 400 Bad Request Errors

**Symptoms:**
- Response with status code 400
- Error message related to invalid parameters

**Possible Causes:**
- Invalid query parameters
- Malformed request body
- Missing required parameters

**Solutions:**
- Check the API documentation for required and optional parameters
- Ensure query parameters have the correct format
- Validate any JSON in the request body

Common parameter format issues:
- Bounding box (bbox) should be an array of 4 numbers: `[minLng, minLat, maxLng, maxLat]`
- Timestamps should be in ISO 8601 format: `2023-01-01T12:00:00Z`
- Ethereum addresses should include the `0x` prefix

### 4. 429 Too Many Requests

**Symptoms:**
- Response with status code 429
- "Too many requests" error message

**Possible Causes:**
- Exceeded rate limits
- Too many requests in a short period

**Solutions:**
- Implement exponential backoff and retry logic
- Reduce request frequency
- Batch requests where possible

Example retry logic:
```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Get retry-after header or use exponential backoff
        const retryAfter = response.headers.get('retry-after') || Math.pow(2, retries) * 1000;
        console.log(`Rate limited. Retrying after ${retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        retries++;
        continue;
      }
      
      return response;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      
      const delay = Math.pow(2, retries) * 1000;
      console.log(`Request failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 5. 500 Internal Server Error

**Symptoms:**
- Response with status code 500
- Generic server error message

**Possible Causes:**
- Server-side issue
- Database connection problems
- Blockchain network issues

**Solutions:**
- Check the API status
- Retry the request after a short delay
- Report the issue if it persists

## Data-Related Issues

### 1. Missing Location Proofs

**Symptoms:**
- Empty results when querying location proofs
- Fewer results than expected

**Possible Causes:**
- No data matching the query parameters
- Sync process not completed
- Recent attestations not yet indexed

**Solutions:**
- Check the sync status: `GET /api/sync/status`
- Broaden your query parameters
- Verify attestations exist on the blockchain
- Wait for the next sync cycle to complete

### 2. Incorrect Coordinates

**Symptoms:**
- Location proofs have unexpected coordinates
- Points appear in the wrong places on a map

**Possible Causes:**
- Coordinate order confusion (lat/lng vs lng/lat)
- Different coordinate reference system
- Data parsing issues

**Solutions:**
- Note that GeoJSON uses longitude, latitude order: `[lng, lat]`
- Check the `srs` field to determine the coordinate reference system
- Verify the location data in the original attestation

### 3. Missing or Invalid Geographic Data

**Symptoms:**
- `null` values for longitude or latitude
- Cannot perform spatial queries

**Possible Causes:**
- Original attestation missing geographic data
- Malformed location data in attestation
- Parsing errors during indexing

**Solutions:**
- Check if the original attestation contains valid location data
- Use the `location` field which contains the raw GeoJSON
- Filter out proofs with missing coordinates: `?filter=hasCoordinates`

## API Integration Issues

### 1. CORS Errors

**Symptoms:**
- Browser console errors about CORS policy
- Unable to access API from frontend applications

**Possible Causes:**
- Cross-Origin Resource Sharing restrictions
- Missing CORS headers

**Solutions:**
- Use a CORS proxy for development
- Implement a backend API service to make requests
- Request CORS support from the API provider

### 2. Performance Issues

**Symptoms:**
- Slow API responses
- Timeouts on large queries

**Possible Causes:**
- Large result sets
- Complex spatial queries
- Network latency

**Solutions:**
- Use pagination with `limit` and `offset` parameters
- Add more specific filters to narrow results
- Use the bbox parameter to limit geographic area
- Implement caching for frequent queries

Example pagination:
```javascript
async function getAllLocationProofs() {
  const results = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`https://api.astral.global/api/v0/location-proofs?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    
    results.push(...data.data);
    
    if (data.data.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }
  
  return results;
}
```

### 3. Data Format Inconsistencies

**Symptoms:**
- Unexpected data structure
- Missing fields
- Type errors in application code

**Possible Causes:**
- API changes
- Different data sources
- Optional fields that are sometimes null

**Solutions:**
- Implement defensive parsing with fallbacks
- Validate API responses before processing
- Use TypeScript or JSON Schema to define expected structures

Example defensive parsing:
```javascript
function parseLocationProof(proof) {
  return {
    id: proof.uid || '',
    chain: proof.chain || 'unknown',
    location: {
      latitude: proof.latitude || null,
      longitude: proof.longitude || null,
      type: proof.location_type || 'unknown'
    },
    timestamp: proof.event_timestamp ? new Date(proof.event_timestamp) : null,
    prover: proof.prover || '',
    // Always provide fallbacks for optional fields
  };
}
```

## Blockchain-Specific Issues

### 1. Chain Sync Delays

**Symptoms:**
- Recently created attestations not appearing
- Missing data for specific chains

**Possible Causes:**
- Sync process delay
- Blockchain network issues
- EAS indexer delays

**Solutions:**
- Check sync status for specific chains
- Trigger a manual sync: `POST /api/sync?chain=sepolia`
- Wait for the next automatic sync cycle

### 2. Revoked Attestations

**Symptoms:**
- Attestations marked as revoked
- Data no longer accessible

**Possible Causes:**
- Attestation revoked by the original attester
- Fraudulent or erroneous attestation

**Solutions:**
- Check revocation status: `GET /api/v0/location-proofs/:uid`
- Include or exclude revoked attestations with the `includeRevoked` parameter
- Verify revocation status on the blockchain

## Sync Issues

### 1. Automatic Sync Not Working

**Symptoms:**
- New attestations not appearing in the API
- Status endpoint shows no recent syncs

**Possible Causes:**
- Cron job issues
- Service configuration problems
- Database connection issues

**Solutions:**
- Check sync status: `GET /api/sync/status`
- Manually trigger a sync: `POST /api/cron/sync`
- Test endpoint availability: `GET /api/cron/sync/test`
- Wait for the automatic sync (runs every minute)

### 2. Revocation Checks Not Updated

**Symptoms:**
- Revoked attestations still show as valid
- Revocation status isn't current

**Possible Causes:**
- Revocation checking temporarily disabled
- Sync job not completing fully

**Solutions:**
- Check the API status for information about revocation checking
- Manually check revocation status on-chain
- Wait for the next sync cycle when revocation checks are enabled

## Reporting Issues

If you encounter persistent issues that aren't covered in this guide:

1. Check if the issue is already reported in the [GitHub issues](https://github.com/DecentralizedGeo/astral-api/issues)
2. Create a new issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - API endpoint and parameters used
   - Error messages and response codes
   - Your environment (browser, OS, etc.)
3. For urgent issues, contact the team through official support channels

## API Status

You can check the current API status at:
```
GET https://api.astral.global/health
```

For more detailed status information, including sync status:
```
GET https://api.astral.global/api/sync/status
```

To verify the cron endpoint is correctly configured:
```
GET https://api.astral.global/api/cron/sync/test
```