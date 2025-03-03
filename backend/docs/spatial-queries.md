# Spatial Queries Guide

This guide explains how to use the spatial query features of the Astral API to find location proofs within specific geographic areas.

## Prerequisites

1. The Supabase PostgreSQL functions for spatial queries should already be created during the database setup process (see SUPABASE-SETUP.md).
2. The `location_proofs` table should have geometry data stored in the `geometry` column.

## Using Bounding Box Queries

A bounding box is defined by four coordinates that create a rectangular area on the map:
- Minimum longitude (western boundary)
- Minimum latitude (southern boundary)
- Maximum longitude (eastern boundary)
- Maximum latitude (northern boundary)

### Basic Bounding Box Query

To query location proofs within a specific geographic area, use the `bbox` parameter:

```typescript
import { supabaseService } from '../services/supabase.service';
import { LocationProofQueryParams } from '../models/types';

async function getProofsInSanFrancisco() {
  const params: LocationProofQueryParams = {
    // San Francisco area bounding box
    bbox: [-122.5, 37.7, -122.3, 37.9], // [minLon, minLat, maxLon, maxLat]
    limit: 100
  };
  
  const proofs = await supabaseService.queryLocationProofs(params);
  return proofs;
}
```

### Combining Spatial and Non-Spatial Filters

You can combine spatial queries with other filters:

```typescript
async function getProofsInLondonForSpecificUser(proverAddress: string) {
  const params: LocationProofQueryParams = {
    // London area bounding box
    bbox: [-0.5, 51.3, 0.3, 51.7],
    prover: proverAddress,
    fromTimestamp: new Date('2023-01-01'),
    limit: 50
  };
  
  const proofs = await supabaseService.queryLocationProofs(params);
  return proofs;
}
```

### Getting Counts of Proofs in an Area

To get the count of proofs within a geographic area:

```typescript
async function countProofsInNewYork() {
  const params: LocationProofQueryParams = {
    // New York City area bounding box
    bbox: [-74.3, 40.5, -73.7, 40.9]
  };
  
  const count = await supabaseService.getLocationProofsCount(params);
  return count;
}
```

## Common Bounding Boxes

Here are some common bounding boxes for major cities:

- **San Francisco**: `[-122.5, 37.7, -122.3, 37.9]`
- **New York City**: `[-74.3, 40.5, -73.7, 40.9]`
- **London**: `[-0.5, 51.3, 0.3, 51.7]`
- **Tokyo**: `[139.5, 35.5, 140.0, 35.9]`
- **Sydney**: `[150.9, -34.1, 151.3, -33.7]`

## Using Supabase Client Directly

If you need to access the spatial functions directly from a client application, you can use the Supabase JavaScript client:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project-id.supabase.co',
  'your-anon-key'
)

// Query with bounding box filter
const { data, error } = await supabase
  .rpc('location_proofs_in_bbox', { 
    min_lng: -122.5, 
    min_lat: 37.7, 
    max_lng: -122.3, 
    max_lat: 37.9
  })

// Query with radius filter
const { data, error } = await supabase
  .rpc('location_proofs_within', { 
    lng: -122.4, 
    lat: 37.8, 
    distance_meters: 5000
  })
```

## Performance Considerations

- Spatial queries can be more computation-intensive than regular queries
- For large datasets, consider adding additional filters to narrow down the results
- The `limit` parameter should be used to prevent returning too many results
- Use the appropriate spatial function for your needs:
  - `location_proofs_in_bbox` for rectangular areas (faster for large areas)
  - `location_proofs_within` for precise radius-based searches