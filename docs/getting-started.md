---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
slug: /getting-started
---

# Getting Started with Astral API

This guide will help you get started with the Astral Protocol API, a service for accessing location proof attestations from multiple blockchains.

## What is Astral Protocol?

Astral's Location Proof Protocol provides a system for creating, storing, and verifying location proofs. These proofs are stored as attestations on multiple blockchains using the Ethereum Attestation Service (EAS).

The Astral API provides a simple REST interface to query these attestations.

## API Overview

The Astral API provides:

1. **Location Proofs** - Access to geospatially indexed location attestations
2. **Blockchain Sync** - Automatic synchronization with multiple blockchains
3. **Spatial Queries** - Geographic filtering capabilities
4. **Revocation Checking** - Verification of attestation validity
5. **Automatic Sync** - Background synchronization runs every minute to keep data fresh

## Supported Blockchains

The API currently supports the following blockchains:

- Arbitrum
- Base
- Celo
- Sepolia (Ethereum testnet)

## Quick Start

### Making Your First API Request

Let's make a simple request to check if the API is running:

```bash
curl https://api.astral.global/health
```

You should receive a response like:

```json
{
  "status": "ok",
  "message": "Astral API is running"
}
```

### Get API Configuration

To see the supported chains and schema information:

```bash
curl https://api.astral.global/api/v0/config
```

Response:

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

### Query Location Proofs

To get a list of location proofs, you can make a GET request to the location-proofs endpoint:

```bash
curl https://api.astral.global/api/v0/location-proofs
```

By default, this will return the most recent 100 location proofs.

### Filtered Query Example

To get location proofs for a specific chain and address:

```bash
curl "https://api.astral.global/api/v0/location-proofs?chain=sepolia&prover=0xabcdef1234567890abcdef1234567890abcdef12&limit=10"
```

## Integration Examples

### JavaScript (Node.js)

```javascript
const axios = require('axios');

async function getLocationProofs() {
  try {
    // Get all location proofs
    const response = await axios.get('https://api.astral.global/api/v0/location-proofs');
    console.log(`Found ${response.data.count} location proofs`);
    console.log(response.data.data);
  } catch (error) {
    console.error('Error fetching location proofs:', error);
  }
}

getLocationProofs();
```

### Python

```python
import requests

def get_location_proofs():
    try:
        # Query proofs within a specific area (San Francisco)
        params = {
            'bbox': '-122.5,37.7,-122.3,37.9',  # minLng,minLat,maxLng,maxLat
            'limit': 20
        }
        response = requests.get('https://api.astral.global/api/v0/location-proofs', params=params)
        response.raise_for_status()
        
        data = response.json()
        print(f"Found {data['count']} location proofs in San Francisco")
        for proof in data['data']:
            print(f"Proof ID: {proof['uid']}, Location: {proof['latitude']}, {proof['longitude']}")
            
    except requests.exceptions.RequestException as e:
        print(f"Error fetching location proofs: {e}")

get_location_proofs()
```

### Web Application (React)

```jsx
import React, { useState, useEffect } from 'react';

function LocationProofsList() {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('https://api.astral.global/api/v0/location-proofs');
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setProofs(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <p>Loading location proofs...</p>;
  if (error) return <p>Error loading location proofs: {error}</p>;

  return (
    <div>
      <h2>Location Proofs</h2>
      <ul>
        {proofs.map(proof => (
          <li key={proof.uid}>
            <strong>Location:</strong> {proof.latitude}, {proof.longitude}
            <br />
            <strong>Time:</strong> {new Date(proof.event_timestamp).toLocaleString()}
            <br />
            <strong>Chain:</strong> {proof.chain}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LocationProofsList;
```

## Next Steps

Now that you've made your first requests to the Astral API, check out these resources to learn more:

- [API Reference](./api-reference.md) - Complete reference for all API endpoints
- [Data Model](./data-model.md) - Information about the data model and structure
- [Authentication](./authentication.md) - Information about authentication (coming soon)
- [SDK Documentation](./sdk-documentation.md) - Client SDKs for various languages (coming soon)

## Getting Help

If you have questions or run into issues with the API, please:

1. Check the [API Reference](./api-reference.md) for detailed documentation
2. Review the [Troubleshooting Guide](./troubleshooting.md) for common issues
3. Create an issue in the [GitHub repository](https://github.com/DecentralizedGeo/astral-api)
4. Reach out to the team through [our community channels](https://github.com/DecentralizedGeo/astral-api)