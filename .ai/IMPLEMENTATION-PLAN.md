# Detailed Implementation Plan (Small, Step-by-Step Tasks)

Below is a plan broken down into **small tasks** that an AI agent can execute **without losing context**.

---

## Phase 1: Repo Setup & Environment Preparation ✅

1. **Fork & Clone**: Fork `AstralProtocol/api` on GitHub, then clone to local.
2. **Create a Branch**: Name it `feature/supabase-integration`.
3. **Create `/backend` Folder**: Inside the repo, make a new folder `backend/`.
4. **Add `.env.example`**: Include placeholders for DB connection string, EAS endpoints, etc.
5. **Check for Existing Docker Compose**: If none, create `docker-compose.yml` in `/backend`.
6. **Define Docker Services**:
   - **Service 1**: Postgres DB (with PostGIS) on port 5432.
   - **Service 2**: API container (Node.js or Python, depending on final decision).
   - **Service 3**: (Optional) Test DB or ephemeral DB for CI.
7. **Write Minimal Dockerfile** for the API (placeholder, to be refined).
8. **Push Changes** to GitHub.

---

## Phase 2: Database Schema & Supabase Integration ✅

1. **Log into Supabase**: Create a new project if not already done.
2. **Obtain Credentials**: Copy Supabase connection string.
3. **Configure `.env`**: Paste Supabase `DATABASE_URL` (service role) into `.env.example`.
4. **Setup DB Migrations**:
   - If using raw SQL, create a `migrations` folder.
   - If using an ORM (e.g., Prisma/Sequelize), run `npx prisma init` or `sequelize init`, etc.
5. **Add PostGIS Extension**:
   - For Supabase, run `CREATE EXTENSION IF NOT EXISTS postgis;` in migrations or DB console.
6. **Create Table**: `location_proofs` with columns:
   - `uid VARCHAR PRIMARY KEY` (or text)
   - `chain VARCHAR`
   - `prover VARCHAR`
   - `subject VARCHAR`
   - `eventTimestamp TIMESTAMP` or `TIMESTAMPTZ`
   - `geometry GEOMETRY(Geometry, 4326)` (**supports Points, LineStrings, Polygons, etc.**)
   - `locationType VARCHAR` (e.g. 'Point', 'LineString', etc.)
   - `recipeType JSONB`
   - `mediaType JSONB`
   - `mediaData JSONB`
   - `revoked BOOLEAN DEFAULT false`
7. **Enable Realtime** for `location_proofs` in Supabase UI (publishing inserts/updates).
8. **Test Local DB** via Docker Compose: confirm you can connect, run migrations.
9. **Push Changes** to GitHub.

---

## Phase 3: EAS Attestation Ingestion ✅

1. **Review EAS Indexer**: Read the [eas-indexing-service docs](https://github.com/ethereum-attestation-service/eas-indexing-service).
2. **Decide Polling or Indexer**: If polling EAS GraphQL, define your approach.
3. **Create Ingestion Script** (`fetchAttestations.js` or similar):
   - Accept arguments: `--chain`, `--lastTimestamp`.
   - Query the EAS endpoint for new attestations.
   - Decode attestation fields:
     - Parse `geometry` from the location data (could be point, line, polygon, etc.)
     - Insert into `geometry` column using PostGIS functions (e.g. `ST_GeomFromText` or `ST_GeomFromGeoJSON`).
   - Insert rows into `location_proofs`.
4. **Store State**: In DB or a file, track last processed block/timestamp.
5. **Error Handling**:
   - Retries on network failure.
   - Logging with console or a dedicated logger.
6. **Detect Revocations**:
   - Query revocation status if available.
   - Mark `revoked=true` in DB.
7. **Create Cron or Worker** to run script periodically (e.g. every minute).
8. **Push Changes** to GitHub.

---

## Phase 4: Supabase API Integration & Enhancement ✅

1. **Extend Supabase Service**:
   - Complete CRUD operations using Supabase client
   - Enable PostGIS-specific queries through Supabase RPC
   - Set up appropriate Row Level Security (RLS) policies
   - Create helper functions for common queries

2. **Add Express Endpoints**:
   - `/` (Landing Page): Return JSON with API info.
   - `/health`: Simple health check endpoint.
   - `/sync` (Admin): Trigger manual sync of attestations.
   - `/api/v0/config`: Return available chains and metadata.

3. **Historical Attestation Sync**:
   - Create a batch processing script to fetch all historical attestations
   - Support resumable fetch operations if interrupted
   - Track progress and provide status endpoint

4. **Spatial Query Support** ✅:
   - Add spatial filtering parameters (bbox, near, etc.)
   - Create PostGIS functions for advanced spatial operations
   - Expose these through Supabase RPC or API endpoints

5. **Documentation**:
   - Document Supabase schema and tables
   - Create examples of API usage through Supabase client
   - Document custom endpoints and functionality

6. **Push Changes** to GitHub.

---

## Phase 5: Background Sync & Monitoring ✅

1. **Background Worker Implementation**:
   - Create dedicated worker to sync attestations periodically
   - Support multiple chains with separate checkpoints
   - Add retry mechanism for failed fetches
   - Implement deduplication logic

2. **Monitoring & Alerts**:
   - Add detailed logging with structured format
   - Create metrics collection for sync operations
   - Add alerts for sync failures or service interruptions
   - Track Supabase API usage and quotas

3. **Admin Panel**:
   - Create simple admin interface to view sync status
   - Add ability to force resync of specific chains
   - Show statistics about attestation counts
   - Monitor database size and performance

4. **Push Changes** to GitHub.

---

## Phase 6: CI/CD & Automated Testing ✅

1. **Vercel Deployment Pipeline**:
   - Configured automatic deployments triggered by git pushes
   - Set up build process to compile TypeScript source files
   - Configured routes in vercel.json for Express compatibility
   - Set up cron jobs for automatic data synchronization
2. **Deployment Documentation**:
   - Created VERCEL-DEPLOY.md with step-by-step instructions
   - Added troubleshooting guide for common deployment issues
   - Documented all required environment variables
3. **Monitoring**:
   - Added timestamp to API responses for deployment verification
   - Created health check endpoint for monitoring service status
4. **Build Optimization**:
   - Removed dist directory from git (builds happen during deployment)
   - Fixed TypeScript configuration for proper Vercel builds
   - Resolved circular dependency in build configuration
5. **Testing**:
   - Verified all API routes in serverless environment
   - Added testing for backend Supabase integration
6. **Documentation and Reports** created for deployment process

---

## Phase 8: OGC API Features Implementation ✅

0. **Create new branch**: Build this on a new branch, we'll open a PR on Github once it is pushed
1. **Choose Framework**: Express.js.
2. **Add Routes**:
   - `/ogc/` (Landing Page): Return JSON with API info & links.
   - `/ogc/conformance`: Return an array of OGC conformance URIs.
   - `/ogc/collections`: List available data collections (e.g., `location-proofs`).
   - `/ogc/collections/location-proofs`: Return metadata about the collection.
   - `/ogc/collections/location-proofs/items`: Return an array of location proofs in GeoJSON FeatureCollection.
     - Support `bbox` & `datetime` query params.
3. **GeoJSON Formatting**:
   - Convert each row into a `Feature` with `id`, `geometry`, `properties`.
   - `geometry` from DB `geometry` column (could be any valid GeoJSON geometry type).
   - `properties` include `chain`, `prover`, etc.
4. **Pagination**: Add `limit` & `offset` or a `next` link.
5. **OGC Validation**:
   - Download OGC API validator.
   - Test each endpoint.
6. **Document**: 
   - Update documentation so this is thoroughly documented
   - Update all references to the endpoint to refer to api.astral.global

---

## Phase 8: GraphQL API with Apollo ⬜

0. **Configuration**: The endpoint should be available at `/graphql`
1. **Install Dependencies**: `npm install apollo-server graphql` (or relevant libs).
2. **Create `schema.graphql`** with appropriate types and queries.
3. **Implement Resolvers** for queries and mutations.
4. **Set Up Apollo Server** and merge with existing Express app.
5. **Add Security Features** like rate limiting and depth limiting.
6. **Create Documentation** for GraphQL API.

---

## Phase 9: Deployment & Production Readiness ⬜

1. **Production Environment Setup**:
   - Configure production Supabase project
   - Set up proper backups and disaster recovery
   - Implement security best practices

2. **Performance Optimization**:
   - Add appropriate indexes for common queries
   - Implement caching where appropriate
   - Optimize batch operations for large datasets

3. **Documentation**: 
   - Finalize API documentation
   - Create deployment guide
   - Document maintenance procedures

4. **Security Review**:
   - Audit authentication mechanisms
   - Review access controls and RLS policies
   - Check for potential vulnerabilities

5. **Launch Preparation**:
   - Final testing in staging environment
   - Plan for monitoring during launch
   - Create rollback procedures if needed

---

## Future Work

### Advanced Features
1. **Enable Subscriptions** for real-time updates.
2. **Advanced Filtering** for location data.
3. **Aggregation APIs** for analytics.
4. **Batch Operations** for bulk data processing.
5. **Multi-tenant Support** if needed.

---

## Conclusion
This implementation plan emphasizes getting a functional service deployed quickly with Supabase's built-in API capabilities. The plan prioritizes syncing attestations and making data available, while deferring the custom OGC API and GraphQL implementations to future work. This approach allows for faster time-to-market while maintaining the flexibility to add more specialized APIs later.