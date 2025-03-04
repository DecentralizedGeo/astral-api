# Deployment Checklist for Astral API on Vercel

Follow this checklist to ensure a successful deployment of the Astral API on Vercel:

## Pre-Deployment Preparation

1. ✅ Fix TypeScript build errors
   - [x] Fix import errors in `src/api/cron/sync.ts`
   - [x] Fix method calls in the EasWorker
   - [x] Fix missing type declarations by installing `@types/pg` and `@types/supertest`

2. ✅ Ensure all environment variables are properly defined
   - [x] Create `.env.example` for reference
   - [x] Add `EAS_SCHEMA_RAW_STRING` to configuration

## Vercel Deployment Steps

1. ✅ Connect your GitHub repository to Vercel
   - [x] Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - [x] Click "Add New" > "Project"
   - [x] Select your GitHub repository

2. ✅ Configure project settings
   - [x] Framework Preset: Choose "Other"
   - [x] Root Directory: `backend`
   - [x] Build Command: `npm run build`
   - [x] Output Directory: `dist`
   - [x] Install Command: `npm install`

3. ✅ Add all required environment variables
   ```
   DATABASE_URL=<your-supabase-postgres-url>
   SUPABASE_URL=<your-supabase-project-url>
   SUPABASE_KEY=<your-supabase-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   EAS_ENDPOINT_ARBITRUM=https://arbitrum.easscan.org/graphql
   EAS_ENDPOINT_CELO=https://celo.easscan.org/graphql
   EAS_ENDPOINT_SEPOLIA=https://sepolia.easscan.org/graphql
   EAS_ENDPOINT_BASE=https://base.easscan.org/graphql
   EAS_SCHEMA_UID=0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2
   EAS_SCHEMA_RAW_STRING="uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo"
   NODE_ENV=production
   ```

4. ✅ Deploy your project
   - [x] Click "Deploy"
   - [x] Wait for the deployment to finish
   - [x] Check the deployment logs for any errors

5. ✅ Enable Cron Jobs
   - [x] Go to your project settings in Vercel
   - [x] In the left sidebar, click on "Cron Jobs"
   - [x] Ensure the cron job for `/api/cron/sync` is enabled
   - [x] Verify it's scheduled to run every 15 minutes (`*/15 * * * *`)

## Post-Deployment Verification

1. ✅ Test API Endpoints
   - [x] `https://api.astral.global/health` (should return status: "ok")
   - [x] `https://api.astral.global/api/v0/config` (should return configuration)

2. ✅ Test Sync Functionality
   - [x] Make a POST request to: `https://api.astral.global/api/sync`
   - [x] Check the sync status with a GET request to: `https://api.astral.global/api/sync/status`

3. ✅ Monitor the automatic cron job
   - [x] Check logs in Vercel dashboard after 15 minutes
   - [x] Make sure data is being synced correctly

## Troubleshooting

If you encounter issues:

1. Check the Vercel deployment logs for errors
2. Verify all environment variables are set correctly
3. Ensure your Supabase database is set up correctly
4. Check the database connection is working
5. For revocation checking issues, review the implementation in `eas.service.ts`

## Additional Notes

- Vercel's free tier has a 10-second execution limit for serverless functions
- For longer-running processes, consider upgrading to a paid plan or using a separate service
- The cron job will automatically run every 15 minutes to sync new attestations