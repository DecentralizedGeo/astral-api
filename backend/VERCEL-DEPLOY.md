# Deploying the Astral API to Vercel

Follow these steps to deploy the Astral API backend to Vercel:

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. A Supabase account (sign up at [supabase.com](https://supabase.com))
3. Your GitHub repository connected to Vercel

## Step 1: Set up Supabase

1. Create a new Supabase project
2. Enable the PostGIS extension by running:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Set up the location_proofs table by running your migrations or using this SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS location_proofs (
     uid VARCHAR PRIMARY KEY,
     chain VARCHAR NOT NULL,
     prover VARCHAR NOT NULL,
     subject VARCHAR,
     event_timestamp TIMESTAMPTZ NOT NULL,
     geometry GEOMETRY(Geometry, 4326),
     location_type VARCHAR,
     recipe_type JSONB,
     media_type JSONB,
     media_data JSONB,
     revoked BOOLEAN DEFAULT false
   );
   
   CREATE INDEX IF NOT EXISTS location_proofs_geometry_idx ON location_proofs USING GIST (geometry);
   CREATE INDEX IF NOT EXISTS location_proofs_chain_idx ON location_proofs (chain);
   CREATE INDEX IF NOT EXISTS location_proofs_prover_idx ON location_proofs (prover);
   CREATE INDEX IF NOT EXISTS location_proofs_event_timestamp_idx ON location_proofs (event_timestamp);
   ```

4. Get your Supabase connection URL and API key from the project settings

## Step 2: Deploy to Vercel

1. Go to your Vercel dashboard and click "Add New" > "Project"
2. Select your GitHub repository
3. Configure the project:
   - Framework Preset: Choose "Other"
   - Root Directory: `backend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. Add the following environment variables:
   
   | Variable Name | Value |
   |---------------|-------|
   | DATABASE_URL | Your Supabase PostgreSQL URL (with password) |
   | SUPABASE_URL | Your Supabase project URL |
   | SUPABASE_KEY | Your Supabase service role key |
   | EAS_ENDPOINT_ARBITRUM | https://arbitrum.easscan.org/graphql |
   | EAS_ENDPOINT_CELO | https://celo.easscan.org/graphql |
   | EAS_ENDPOINT_SEPOLIA | https://sepolia.easscan.org/graphql |
   | EAS_ENDPOINT_BASE | https://base.easscan.org/graphql |
   | EAS_SCHEMA_UID | 0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2 |
   | NODE_ENV | production |

5. Click "Deploy"

## Step 3: Enable Cron Jobs

1. After your initial deployment is successful, go to your project settings
2. In the left sidebar, find "Cron Jobs" and click on it
3. Vercel will automatically detect the cron job in your vercel.json file
4. Make sure the cron job is enabled: `/api/cron/sync` with schedule `*/15 * * * *`

## Step 4: Test Your Deployment

1. Test the deployment by visiting the following endpoints:
   - `https://api.astral.global/health` (should return status: "ok")
   - `https://api.astral.global/api/v0/config` (should return configuration)

2. To manually trigger a sync, make a POST request to:
   - `https://api.astral.global/api/sync`

3. To check the sync status, make a GET request to:
   - `https://api.astral.global/api/sync/status`

## Notes

1. The cron job will automatically run every 15 minutes to sync new attestations
2. Vercel's free tier has limitations on execution time (10 seconds for serverless functions)
3. For more intensive processing, consider upgrading to Vercel Pro or using a different hosting solution
4. The worker is stateless and will sync from where it left off based on database state