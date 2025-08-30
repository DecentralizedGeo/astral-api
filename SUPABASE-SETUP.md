# Supabase Setup Guide for Astral Protocol API

## Overview

This guide provides instructions for setting up Supabase to work with the Astral Protocol API. The database schema is defined in migration SQL files. You should run these files directly in the Supabase dashboard SQL editor to set up your production database.

## Prerequisites

- A Supabase account
- Access to the Supabase dashboard for your project
- Your Supabase project URL and API key

## Database Setup

### 1. Install and Configure Schema

**Run the following migration files in order using the Supabase SQL Editor:**

1. [`001_initial_schema.sql`](backend/src/migrations/001_initial_schema.sql):
   - Installs the PostGIS extension
   - Creates the `location_proofs` table, geometry column, indexes, update trigger, RLS policies, and spatial query functions
   - Sets up a publication for Supabase Realtime
2. [`002_create_worker_stats.sql`](backend/src/migrations/002_create_worker_stats.sql):
   - Creates the `worker_stats` table for tracking worker process statistics
3. [`003_create_sync_history.sql`](backend/src/migrations/003_create_sync_history.sql):
   - Creates the `sync_history` table for storing sync run stats as JSONB
   - Adds an index on `created_at`

> **How to run:**
>
> - Open the Supabase dashboard for your project
> - Go to the SQL Editor
> - Open each migration file above, copy its contents, and run it in the editor (in order)

### 2. Environment Configuration

Update your `.env` file with the following values:

```env
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

Obtain your Service Role Key from Supabase:

- Go to Project Settings > API
- Find the "service_role" key (with secret access)
- Copy and paste into your `.env` file

## Syncing Attestations

After setting up the database, you can sync attestations using these commands:

- **Sync all chains:**

  ```bash
  npm run sync:historical
  ```

- **Sync a specific chain:**

  ```bash
  npm run sync:historical:sepolia
  npm run sync:historical:base
  ```

- **Sync with custom batch size:**

  ```bash
  npx ts-node src/scripts/sync-historical-attestations.ts sepolia 50
  ```

## Using the API

The Astral API provides these endpoints:

- `GET /api/v0/config` — Config Information
- `GET /api/v0/location-proofs` — List location proofs
- `GET /api/v0/location-proofs/:uid` — Get a specific proof
- `GET /api/v0/location-proofs/stats` — Proof stats
- `GET /api/sync/status` — Sync status
- `POST /api/sync` — Trigger sync

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
const { data: spatialData, error: spatialError } = await supabase
  .rpc('location_proofs_within', { 
    lng: -74.0060, 
    lat: 40.7128, 
    distance_meters: 1000 
  })
```

See the [Supabase docs](https://supabase.com/docs/reference/javascript/select) for more usage examples.

## Troubleshooting

If you encounter issues:

1. Verify your Supabase configuration in the `.env` file
2. Check that the PostGIS extension is properly installed
3. Ensure your service role key has the necessary permissions
4. Check the application logs for more detailed error messages

## Notes

- The migration SQL files in [`backend/src/migrations/`](backend/src/migrations/) are the authoritative source for all schema, permissions, and functions. Always run these files to set up or update your production database.
- If you add new tables or functions, update the migration files and reference them here.
- If you change the migration SQL files, you must also update the expected schemas in [`backend/src/scripts/validate-schema.ts`](backend/src/scripts/validate-schema.ts) to keep schema validation accurate.