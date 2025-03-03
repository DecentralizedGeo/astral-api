# Supabase Setup Guide for Astral Protocol API

## Overview
This guide provides instructions for setting up Supabase to work with the Astral Protocol API. You'll need to set up the database schema, configure permissions, and then sync attestations.

## Prerequisites
- A Supabase account
- Access to the Supabase dashboard for your project
- Your Supabase project URL and API key

## Database Setup

1. **Install PostGIS Extension**
   
   In your Supabase dashboard, go to the SQL Editor and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **Create Location Proofs Table**
   
   Run the following SQL to create the table:
   ```sql
   CREATE TABLE IF NOT EXISTS public.location_proofs (
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
   CREATE INDEX IF NOT EXISTS idx_location_proofs_chain ON public.location_proofs(chain);
   CREATE INDEX IF NOT EXISTS idx_location_proofs_prover ON public.location_proofs(prover);
   CREATE INDEX IF NOT EXISTS idx_location_proofs_subject ON public.location_proofs(subject);
   CREATE INDEX IF NOT EXISTS idx_location_proofs_timestamp ON public.location_proofs(event_timestamp);
   CREATE INDEX IF NOT EXISTS idx_location_proofs_geometry ON public.location_proofs USING GIST(geometry);

   -- Create update timestamp trigger
   CREATE OR REPLACE FUNCTION update_timestamp()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
      
   DROP TRIGGER IF EXISTS set_timestamp ON public.location_proofs;
   CREATE TRIGGER set_timestamp
   BEFORE UPDATE ON public.location_proofs
   FOR EACH ROW
   EXECUTE PROCEDURE update_timestamp();
   ```

3. **Configure Row Level Security (RLS) Policies**

   Enable Row Level Security and set up appropriate policies:
   ```sql
   -- Enable RLS on the table
   ALTER TABLE public.location_proofs ENABLE ROW LEVEL SECURITY;

   -- Create policy for anonymous read access
   CREATE POLICY "Allow anonymous read access" 
   ON public.location_proofs
   FOR SELECT
   USING (true);

   -- Create policy for service role to have full access
   CREATE POLICY "Allow service role full access"
   ON public.location_proofs
   USING (auth.role() = 'service_role');
   ```

4. **Create Spatial Query Functions**

   Add these PostGIS functions for convenient spatial queries:
   ```sql
   -- Function to find location proofs within a certain distance of a point
   CREATE OR REPLACE FUNCTION location_proofs_within(
     lng NUMERIC,
     lat NUMERIC,
     distance_meters NUMERIC
   ) RETURNS SETOF location_proofs AS $$
   BEGIN
     RETURN QUERY
     SELECT *
     FROM location_proofs
     WHERE ST_DWithin(
       geometry,
       ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
       distance_meters
     );
   END;
   $$ LANGUAGE plpgsql;

   -- Function to find location proofs within a bounding box
   CREATE OR REPLACE FUNCTION location_proofs_in_bbox(
     min_lng NUMERIC,
     min_lat NUMERIC,
     max_lng NUMERIC,
     max_lat NUMERIC
   ) RETURNS SETOF location_proofs AS $$
   BEGIN
     RETURN QUERY
     SELECT *
     FROM location_proofs
     WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
   END;
   $$ LANGUAGE plpgsql;
   ```

## Environment Configuration

1. Update your `.env` file with the following values:
   ```
   # Database
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/astral
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # EAS Endpoints
   EAS_ENDPOINT_ARBITRUM=https://arbitrum.easscan.org/graphql
   EAS_ENDPOINT_CELO=https://celo.easscan.org/graphql
   EAS_ENDPOINT_SEPOLIA=https://sepolia.easscan.org/graphql
   EAS_ENDPOINT_BASE=https://base.easscan.org/graphql

   # EAS Schema UID
   EAS_SCHEMA_UID=0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2
   EAS_SCHEMA_RAW_STRING="uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo"

   # API Configuration
   PORT=3000
   NODE_ENV=development
   ```

2. Obtain your Service Role Key from Supabase:
   - Go to Project Settings > API
   - Find the "service_role" key (with secret access)
   - Copy and paste into your `.env` file

## Syncing Attestations

After setting up the database, you can sync attestations using these commands:

1. **Sync all chains**:
   ```bash
   npm run sync:historical
   ```

2. **Sync a specific chain**:
   ```bash
   # For Sepolia
   npm run sync:historical:sepolia
   
   # For Base
   npm run sync:historical:base
   ```

3. **Sync with custom batch size**:
   ```bash
   # Sync Sepolia with batch size of 50
   npx ts-node src/scripts/sync-historical-attestations.ts sepolia 50
   ```

## Using the API

The Astral API now provides these endpoints:

1. **Config Information**:
   ```
   GET /api/v0/config
   ```

2. **Location Proofs**:
   ```
   GET /api/v0/location-proofs
   GET /api/v0/location-proofs/:uid
   GET /api/v0/location-proofs/stats
   ```

3. **Sync Management**:
   ```
   GET /api/sync/status
   POST /api/sync
   ```

## Direct Supabase API Access

You can also access the data directly using the Supabase JavaScript client:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project-id.supabase.co',
  'your-anon-key'
)

// Query location proofs
const { data, error } = await supabase
  .from('location_proofs')
  .select('*')
  .eq('chain', 'sepolia')
  .limit(10)

// Query with spatial filter (using PostgREST functions)
const { data, error } = await supabase
  .rpc('location_proofs_within', { 
    lng: -74.0060, 
    lat: 40.7128, 
    distance_meters: 1000 
  })
```

## Troubleshooting

If you encounter issues:

1. Verify your Supabase configuration in the `.env` file
2. Check that the PostGIS extension is properly installed
3. Ensure your service role key has the necessary permissions
4. Check the application logs for more detailed error messages