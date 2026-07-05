# Plan 004: Populate the PostGIS `geometry` column on the production insert path and stop dropping zero-valued coordinates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cf3f342..HEAD -- backend/src/services/supabase.service.ts backend/src/services/eas.service.ts backend/src/services/db.service.ts backend/src/api/ogc/controllers/features.controller.ts backend/src/migrations/ SUPABASE-SETUP.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches ingestion data shape; includes a data backfill)
- **Depends on**: plans/002-restore-verification-baseline-and-ci.md (tests must be green to add new ones)
- **Category**: bug
- **Planned at**: commit `cf3f342`, 2026-07-02

## Why this matters

This is a geospatial API — its flagship feature is spatial querying (bbox on
the OGC endpoint, REST, and GraphQL). Both spatial RPC functions filter on the
PostGIS `geometry` column:

```sql
-- SUPABASE-SETUP.md:114-125 (location_proofs_in_bbox)
WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
```

But the Supabase insert path — which is what production ingestion actually
uses (the pg `DbService` path fails without `DATABASE_URL` and falls back to
Supabase; see the `fix/database-url-errors` commits `74fbb0a`/`61eefbc`) —
**never sets `geometry`**. The `LocationProof` object built by ingestion has
`longitude`/`latitude` but no `geometry` key, and no database trigger computes
it. Rows ingested this way have `geometry = NULL` and are **invisible to every
spatial query**, silently.

Compounding this, three separate code sites use JavaScript truthiness to test
coordinates, so `longitude === 0` or `latitude === 0` (the prime meridian and
the equator — valid places) is treated as "no coordinates".

## Current state

- `backend/src/services/eas.service.ts:534-554` — the ingested proof object;
  note there is no `geometry` field:

  ```ts
  const proof: LocationProof = {
    uid: attestation.id,
    chain,
    prover: attestation.attester,
    subject: attestation.recipient || attestation.attester,
    timestamp,
    event_timestamp,
    srs,
    location_type: locationType,
    location,
    longitude,
    latitude,
    ...
  };
  ```

- `backend/src/services/supabase.service.ts:70-74` — the insert sends that
  object as-is:

  ```ts
  const { data, error } = await client
    .from(this.TABLE_NAME)
    .insert(proof)
    .select()
    .single();
  ```

- Neither `backend/src/migrations/001_initial_schema.sql` nor
  `SUPABASE-SETUP.md` defines any trigger that computes `geometry` from
  `longitude`/`latitude` (the only trigger is `update_timestamp` for
  `updated_at`). The pg path (`db.service.ts:46`) computes it inline with
  `ST_SetSRID(ST_MakePoint(...), 4326)` — which is why the bug is specific to
  the Supabase path.

- The three falsy-zero sites:

  ```ts
  // backend/src/services/db.service.ts:44
  if (proof.longitude && proof.latitude) {

  // backend/src/services/eas.service.ts:444 (validating parsed GeoJSON coords)
  if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {

  // backend/src/api/ogc/controllers/features.controller.ts:349 (read-time fallback)
  if (!geometry && proof.longitude && proof.latitude) {
  ```

- Migrations are run by `backend/src/migrations/run-migrations.ts`
  (`npm run db:migrate`), which applies the `.sql` files in the migrations
  directory. Read it before adding a file to confirm ordering behavior
  (it is 84 lines).

Repo conventions: raw SQL migration files numbered `NNN_description.sql` in
`backend/src/migrations/`; parameterized queries; PostGIS for geometry
(`CLAUDE.md` "Database" rule). Tests: Jest, model on
`backend/src/__tests__/db.service.test.ts`.

## Commands you will need

All from `backend/`:

| Purpose | Command | Expected on success |
|-----------|---------------------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 (plan 002 landed) |
| Build | `npm run build` | exit 0 |
| Migrate | `npm run db:migrate`| only with a live DB — see STOP conditions |

There is no local database in `docker-compose.yml` (it defines only the `api`
service), so you likely **cannot apply the migration in this environment**.
The deliverable is the migration file + code changes + tests; applying it to
Supabase is an operator step.

## Scope

**In scope** (the only files you should modify/create):
- `backend/src/migrations/002_geometry_trigger.sql` (create)
- `backend/src/services/db.service.ts` (falsy check only, line 44)
- `backend/src/services/eas.service.ts` (falsy check only, line 444)
- `backend/src/api/ogc/controllers/features.controller.ts` (falsy check only, line 349)
- `SUPABASE-SETUP.md` (append the trigger + backfill SQL so manual setups stay complete)
- New test file(s) under `backend/src/services/__tests__/`

**Out of scope** (do NOT touch):
- `backend/src/services/supabase.service.ts` — the fix is a DB trigger, not
  app-side geometry construction; keeping one source of truth for geometry
  avoids drift between the pg and Supabase paths.
- The bbox RPC functions and their in-memory filtering (plan 005).
- The coordinate-order heuristic in `eas.service.ts:457-495` (separate
  investigate item in the index).
- `001_initial_schema.sql` — never edit an applied migration.

## Git workflow

- Branch: `fix/004-geometry-trigger-and-zero-coords`
- Conventional commits, e.g.
  `fix(db): compute geometry from coordinates via trigger and backfill` and
  `fix(ingest): accept zero-valued coordinates`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the trigger migration

Create `backend/src/migrations/002_geometry_trigger.sql`:

```sql
-- Compute geometry from parsed coordinates whenever a row is inserted or
-- updated and geometry was not explicitly provided.
CREATE OR REPLACE FUNCTION set_geometry_from_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geometry IS NULL
     AND NEW.longitude IS NOT NULL
     AND NEW.latitude IS NOT NULL THEN
    NEW.geometry := ST_SetSRID(
      ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS location_proofs_set_geometry ON location_proofs;
CREATE TRIGGER location_proofs_set_geometry
BEFORE INSERT OR UPDATE ON location_proofs
FOR EACH ROW
EXECUTE FUNCTION set_geometry_from_coordinates();

-- One-time backfill for rows ingested while the bug was live.
UPDATE location_proofs
SET geometry = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE geometry IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;
```

**Verify**: `npx --yes sql-formatter --language postgresql < src/migrations/002_geometry_trigger.sql > /dev/null` exits 0
(or, if unavailable, verify visually that statements are `;`-terminated and
read `run-migrations.ts` to confirm the file will be picked up in order).

### Step 2: Fix the three falsy-zero checks

1. `backend/src/services/db.service.ts:44`:

   ```ts
   if (proof.longitude != null && proof.latitude != null) {
   ```

2. `backend/src/services/eas.service.ts:444` (inside the parsed-GeoJSON
   validation; `latitude`/`longitude` are `number | undefined` here):

   ```ts
   if (
     latitude === undefined || longitude === undefined ||
     !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
     Math.abs(latitude) > 90 || Math.abs(longitude) > 180
   ) {
   ```

3. `backend/src/api/ogc/controllers/features.controller.ts:349`:

   ```ts
   if (!geometry && proof.longitude != null && proof.latitude != null) {
   ```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Update SUPABASE-SETUP.md

Append the trigger function, trigger, and backfill from Step 1 as a new
numbered step in the "Create Spatial Query Functions" area of
`SUPABASE-SETUP.md`, so a fresh manual Supabase setup includes it.

**Verify**: `grep -n "set_geometry_from_coordinates" SUPABASE-SETUP.md` → ≥1 match.

### Step 4: Tests

Add `backend/src/services/__tests__/coordinate-handling.test.ts`:

- `convertAttestationToLocationProof` (exported on `EasService`) with a
  `decodedDataJson` whose location is GeoJSON `{"type":"Point","coordinates":[0,0]}`
  → resulting proof has `longitude === 0` and `latitude === 0` (not
  `undefined`). Build the attestation fixture as in the (post-plan-002)
  `eas.service.test.ts`.
- Same for location string `"0,0"` (simple-format path).
- `locationProofToGeoJSONFeature` is not exported from
  `features.controller.ts`; test the zero-coordinate read path indirectly
  only if an export already exists — otherwise skip (do not change exports;
  note it in your report).
- `db.service` insert with `longitude: 0, latitude: 0` → the SQL passed to the
  mocked pg client contains `ST_MakePoint` (i.e. the coordinates branch was
  taken). Model the pg mocking on `backend/src/__tests__/db.service.test.ts`.

**Verify**: `npm test` → exit 0, new tests listed as passing.

## Test plan

Covered in Step 4: zero-coordinate GeoJSON, zero-coordinate simple format,
zero-coordinate insert branch. The trigger/backfill SQL cannot be executed in
this environment; its correctness gates are the operator applying it to a
staging/production Supabase and running the Done-criteria SQL probe below.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `backend/src/migrations/002_geometry_trigger.sql` exists and contains
      one function, one trigger, one backfill `UPDATE`
- [ ] `grep -n "proof.longitude && proof.latitude" backend/src -r` → no matches
- [ ] `cd backend && npm run typecheck && npm run build` exit 0
- [ ] `cd backend && npm test` exits 0 with the new coordinate tests passing
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated
- [ ] (Operator, post-deploy) `SELECT count(*) FROM location_proofs WHERE geometry IS NULL AND longitude IS NOT NULL;` → `0`

## STOP conditions

Stop and report back (do not improvise) if:

- `run-migrations.ts` turns out not to apply new `.sql` files automatically
  (e.g. it hardcodes `001_initial_schema.sql`) — report; the fix would extend
  to that file, which is out of scope here.
- A geometry-computing trigger already exists in the live schema (check
  `SUPABASE-SETUP.md` and any new migration files for `ST_MakePoint` before
  writing yours) — the bug may have been fixed operationally; reconcile first.
- The `LocationProof` type or insert call in `supabase.service.ts:70-74` has
  changed to include a `geometry` field — app-side and trigger-side geometry
  would then conflict.
- Fixing the falsy checks surfaces typecheck errors implying
  `longitude`/`latitude` are strings at those sites — the DB `NUMERIC`
  columns can round-trip as strings via some drivers; report rather than
  cast blindly.

## Maintenance notes

- Plan 005 (bbox push-down) assumes `geometry` is reliably populated — this
  plan must land and be applied to the database first.
- Full-shape GeoJSON storage (LineString/Polygon, not just first-point) is a
  direction item (see index); this trigger only covers point coordinates,
  matching current ingestion behavior.
- Reviewer should scrutinize: the trigger must not overwrite an explicitly
  provided geometry (`NEW.geometry IS NULL` guard), and the backfill must not
  set geometry where coordinates are absent.
- If ingestion ever writes via the pg path again (`DATABASE_URL` configured),
  both paths now produce geometry (inline SQL there, trigger here) —
  consistent, but the DB-layer consolidation item in the index would remove
  the duplication.
