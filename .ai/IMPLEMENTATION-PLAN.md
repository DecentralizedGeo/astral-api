# Detailed Implementation Plan (Small, Step-by-Step Tasks)

Below is a plan broken down into **small tasks** that an AI agent can execute **without losing context**.

---

## Phase 1: Repo Setup & Environment Preparation ✅

1. **Fork & Clone**: Fork `AstralProtocol/api` on GitHub, then clone to local.
2. **Create a Branch**: Name it `feature/ogc-api-implementation`.
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

## Phase 3: EAS Attestation Ingestion ⬜

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

## Phase 4: REST API (OGC API) Implementation ⬜

1. **Choose Framework**: Express.js, Fastify, or Flask (Python). For Node, Express is common.
2. **Add Routes**:
   - `/` (Landing Page): Return JSON with API info & links.
   - `/conformance`: Return an array of OGC conformance URIs.
   - `/collections`: List available data collections (e.g., `location-proofs`).
   - `/collections/location-proofs`: Return metadata about the collection.
   - `/collections/location-proofs/items`: Return an array of location proofs in GeoJSON FeatureCollection.
     - Support `bbox` & `datetime` query params.
3. **GeoJSON Formatting**:
   - Convert each row into a `Feature` with `id`, `geometry`, `properties`.
   - `geometry` from DB `geometry` column (could be any valid GeoJSON geometry type).
   - `properties` include `chain`, `prover`, etc.
4. **Pagination**: Add `limit` & `offset` or a `next` link.
5. **OGC Validation**:
   - Download OGC API validator.
   - Test each endpoint.
6. **Testing**:
   - Write unit tests for route handlers.
   - Use a mock DB or test DB.
7. **Push Changes** to GitHub.

---

## Phase 5: GraphQL API with Apollo ⬜

1. **Install Dependencies**: `npm install apollo-server graphql` (or relevant libs).
2. **Create `schema.graphql`**:
   ```graphql
   # Example geometry type, storing as a JSON object (GeoJSON)
   scalar GeoJSON

   type LocationProof {
     uid: ID!
     chain: String
     prover: String
     subject: String
     eventTimestamp: String
     revoked: Boolean
     geometry: GeoJSON    # can be a Point, LineString, Polygon, etc.
     locationType: String # tracks the geometry type
     # etc.
   }

   input ProofFilter {
     chain: String
     prover: String
     bbox: [Float]
     fromDate: String
     toDate: String
   }

   type Query {
     locationProofs(filter: ProofFilter, limit: Int, offset: Int): [LocationProof]
     locationProof(uid: ID!): LocationProof
   }
   ```
3. **Implement Resolvers**:
   - `Query.locationProofs`:
     - Parse filter, query DB.
     - Return geometry as a valid GeoJSON object.
   - `Query.locationProof`: fetch by `uid`.
4. **Set Up Apollo Server**:
   - In `index.js` or `server.js`, create `new ApolloServer({ typeDefs, resolvers })`.
   - Merge with Express if needed or run standalone.
5. **Add Depth Limiting**: e.g., `graphql-depth-limit` or Apollo’s built-in.
6. **Integration Tests**:
   - Test queries & verify DB results (e.g., geometry field is returned correctly).
7. **Push Changes** to GitHub.

---

## Phase 6: CI/CD & Automated Testing ⬜

1. **GitHub Actions Workflow**:
   - Step 1: Check out code.
   - Step 2: Set up Node.js.
   - Step 3: Run `npm install`.
   - Step 4: Spin up Docker services (Postgres) if needed.
   - Step 5: Run migrations or `npx prisma migrate dev`.
   - Step 6: Run `npm test` for unit/integration tests.
   - Step 7: If tests pass, build Docker image.
   - Step 8: Optionally push image to Docker registry.
2. **Deployment**: Choose target (AWS ECS, Fly.io, etc.).
3. **Monitoring**:
   - Add logs, set up watchers.
4. **Alerts**:
   - Email or Slack notifications on build failures.
5. **Coverage**:
   - Aim for high coverage in unit and integration tests.
6. **Push CI/CD config** to GitHub.

---

## Phase 7: Scaling & Enhancements ⬜

1. **Enable Subscriptions** (optional):
   - Use Apollo Server’s subscription or a separate service.
   - Connect to Supabase Realtime or DB triggers.
2. **Multi-chain Support**:
   - Expand ingestion script to handle multiple chains.
   - Keep a separate checkpoint per chain.
3. **Advanced OGC Filter**:
   - Implement advanced attribute-based filtering if needed.
4. **Security & Auth**:
   - Add API keys or OAuth if certain endpoints require protection.
5. **Cost Optimization**:
   - Monitor Supabase usage.
   - Scale database plan as needed.
6. **Documentation**:
   - Write docs for developers (OpenAPI, GraphQL schema docs).

---

## Phase 8: Final Review & Production Launch ⬜

1. **Security Audit**: Check environment vars, secrets, logs.
2. **Load Test**: Use tools like k6 or Artillery to test concurrency.
3. **Fix Bottlenecks**: Query optimization, indexing, caching.
4. **Announce Beta**: Publish endpoints, get feedback.
5. **Production**: Mark main branch stable, finalize version.
6. **Continual Maintenance**: Monitor logs, bug reports, scale as needed.

---

## Conclusion
These smaller, more granular tasks should help AI agents (e.g., Cursor Agents) **retain context** and execute step-by-step without overwhelming complexity. Each phase builds on the previous, guiding you from initial repo setup to a fully deployed, production-grade, and scalable OGC/GraphQL API.

