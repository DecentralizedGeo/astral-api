# Plan 005: Push bbox filtering, pagination, and counting into PostGIS instead of Node memory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cf3f342..HEAD -- backend/src/services/supabase.service.ts SUPABASE-SETUP.md backend/src/migrations/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes the SQL contract of the spatial query path)
- **Depends on**: plans/002 (green tests), plans/004 (geometry column populated — without it every bbox query legitimately returns nothing and you cannot tell a regression from the pre-existing bug)
- **Category**: perf + security (resource exhaustion)
- **Planned at**: commit `cf3f342`, 2026-07-02

## Why this matters

Every bounding-box query — the OGC `items` endpoint, `/api/v0/location-proofs?bbox=`,
and GraphQL — fetches **every row inside the bbox** from the database into the
Node process, then filters, sorts, and paginates in JavaScript. A list request
with a bbox does this **twice**, because the count is computed by re-running
the same full fetch. A wide bbox (e.g. the whole world, which the OGC
collection extent advertises) transfers the entire table per request, on an
unauthenticated public endpoint. This is both the API's main scaling cliff and
a resource-exhaustion vector. The fix is to extend the PostGIS function so the
database does the filtering, ordering, pagination, and counting.

## Current state

- `backend/src/services/supabase.service.ts:166-202` (`queryLocationProofs`,
  bbox branch):

  ```ts
  if (params.bbox) {
    const [minLon, minLat, maxLon, maxLat] = params.bbox;
    const { data: bboxData, error: bboxError } = await client.rpc(
      'location_proofs_in_bbox',
      { min_lng: minLon, min_lat: minLat, max_lng: maxLon, max_lat: maxLat }
    );
    ...
    const filteredResults = (bboxData as LocationProof[]).filter(proof => { ... });
    const start = params.offset || 0;
    const end = start + (params.limit || filteredResults.length);
    return filteredResults
      .sort((a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime())
      .slice(start, end);
  }
  ```

- `backend/src/services/supabase.service.ts:475-502`
  (`getLocationProofsCount`, bbox branch) — repeats the same full RPC fetch
  and JS-filters, returning `.length`.

- The RPC being called (defined in `SUPABASE-SETUP.md:113-126`, applied
  manually to Supabase — NOT in `backend/src/migrations/`):

  ```sql
  CREATE OR REPLACE FUNCTION location_proofs_in_bbox(
    min_lng NUMERIC, min_lat NUMERIC, max_lng NUMERIC, max_lat NUMERIC
  ) RETURNS SETOF location_proofs AS $$
  BEGIN
    RETURN QUERY
    SELECT * FROM location_proofs
    WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
  END;
  $$ LANGUAGE plpgsql;
  ```

- Callers of `queryLocationProofs`/`getLocationProofsCount` (response shapes
  that must NOT change):
  - `backend/src/api/v0/controllers/location-proofs.controller.ts:97-100`
  - `backend/src/api/ogc/controllers/features.controller.ts:427-430`
  - `backend/src/graphql/resolvers/locationProofResolvers.ts:81,96`

- A near-duplicate legacy function `query_locations_in_bbox` exists in
  `backend/create_spatial_function.sql` — it is referenced only by the
  integration test `backend/src/tests/supabase-spatial.test.ts` docstring;
  leave it alone.

Repo conventions: new SQL ships as a numbered migration in
`backend/src/migrations/` AND is appended to `SUPABASE-SETUP.md` (the live
Supabase instance is configured manually from that doc). Parameterized
queries; PostGIS for geometry operations (`CLAUDE.md`).

## Commands you will need

All from `backend/`:

| Purpose | Command | Expected on success |
|-----------|---------------------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |

No local database exists in this repo's docker-compose; the new SQL is
verified by review + operator application (same caveat as plan 004).

## Scope

**In scope** (the only files you should modify/create):
- `backend/src/migrations/003_bbox_filtered_function.sql` (create; number it
  after whatever the highest existing migration is at execution time)
- `backend/src/services/supabase.service.ts` (both bbox branches)
- `SUPABASE-SETUP.md` (append the new function)
- New test file under `backend/src/services/__tests__/`

**Out of scope** (do NOT touch):
- The controllers and resolvers listed above — the service method signatures
  and return shapes stay identical, so callers must not need changes. If they
  do, that is a STOP condition.
- `backend/create_spatial_function.sql` (legacy; unused by runtime code).
- The non-bbox query path (`supabase.service.ts:204-221`) — its own missing
  default limit is a separate index item; don't entangle it here.
- `location_proofs_in_bbox` — do not DROP or alter the existing function;
  external consumers may call it (docs/spatial-queries.md documents it as a
  client-facing RPC).

## Git workflow

- Branch: `perf/005-bbox-pushdown`
- Conventional commit, e.g.
  `perf(spatial): filter, paginate and count bbox queries in PostGIS`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the filtered RPC

New migration `backend/src/migrations/003_bbox_filtered_function.sql` defining
an additive function (existing `location_proofs_in_bbox` untouched):

```sql
CREATE OR REPLACE FUNCTION location_proofs_in_bbox_filtered(
  min_lng NUMERIC, min_lat NUMERIC, max_lng NUMERIC, max_lat NUMERIC,
  filter_chain VARCHAR DEFAULT NULL,
  filter_prover VARCHAR DEFAULT NULL,
  filter_subject VARCHAR DEFAULT NULL,
  from_ts TIMESTAMPTZ DEFAULT NULL,
  to_ts TIMESTAMPTZ DEFAULT NULL,
  result_limit INTEGER DEFAULT 100,
  result_offset INTEGER DEFAULT 0
) RETURNS SETOF location_proofs AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM location_proofs
  WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND (filter_chain IS NULL OR chain = filter_chain)
    AND (filter_prover IS NULL OR prover = filter_prover)
    AND (filter_subject IS NULL OR subject = filter_subject)
    AND (from_ts IS NULL OR event_timestamp >= from_ts)
    AND (to_ts IS NULL OR event_timestamp <= to_ts)
  ORDER BY event_timestamp DESC
  LIMIT LEAST(GREATEST(result_limit, 0), 1000)
  OFFSET GREATEST(result_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION location_proofs_in_bbox_count(
  min_lng NUMERIC, min_lat NUMERIC, max_lng NUMERIC, max_lat NUMERIC,
  filter_chain VARCHAR DEFAULT NULL,
  filter_prover VARCHAR DEFAULT NULL,
  filter_subject VARCHAR DEFAULT NULL,
  from_ts TIMESTAMPTZ DEFAULT NULL,
  to_ts TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT AS $$
  SELECT count(*)
  FROM location_proofs
  WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND (filter_chain IS NULL OR chain = filter_chain)
    AND (filter_prover IS NULL OR prover = filter_prover)
    AND (filter_subject IS NULL OR subject = filter_subject)
    AND (from_ts IS NULL OR event_timestamp >= from_ts)
    AND (to_ts IS NULL OR event_timestamp <= to_ts);
$$ LANGUAGE sql STABLE;
```

The hard cap of 1000 matches the OGC controller's validated maximum
(`features.controller.ts:279`).

**Verify**: statements are `;`-terminated; file is picked up by
`run-migrations.ts` ordering (read it to confirm, as in plan 004).

### Step 2: Rewire `queryLocationProofs`

Replace the bbox branch (`supabase.service.ts:166-202`) with a single call:

```ts
const { data: bboxData, error: bboxError } = await client.rpc(
  'location_proofs_in_bbox_filtered',
  {
    min_lng: minLon, min_lat: minLat, max_lng: maxLon, max_lat: maxLat,
    filter_chain: params.chain ?? null,
    filter_prover: params.prover ?? null,
    filter_subject: params.subject ?? null,
    from_ts: params.fromTimestamp?.toISOString() ?? null,
    to_ts: params.toTimestamp?.toISOString() ?? null,
    result_limit: params.limit ?? 100,
    result_offset: params.offset ?? 0,
  }
);
if (bboxError) { logger.error('Error executing spatial query:', bboxError); return []; }
return (bboxData ?? []) as LocationProof[];
```

Delete the JS `.filter/.sort/.slice` block entirely.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Rewire `getLocationProofsCount`

Replace the bbox branch (`supabase.service.ts:475-502`) with a call to
`location_proofs_in_bbox_count` passing the same filter arguments, returning
`Number(data ?? 0)`.

**Verify**: `npm run typecheck` → exit 0;
`grep -n "filter(proof" src/services/supabase.service.ts` → no matches.

### Step 4: Tests

Add `backend/src/services/__tests__/supabase.bbox.test.ts` mocking
`@supabase/supabase-js`'s `createClient` so `rpc` is a jest mock:

- bbox + chain + limit/offset → asserts `rpc` called once with
  `location_proofs_in_bbox_filtered` and the exact argument object (nulls for
  unset filters).
- count path → asserts `rpc` called with `location_proofs_in_bbox_count` and
  no `result_limit`/`result_offset` keys.
- rpc error → returns `[]` / `0` (preserve existing error contract).
- non-bbox queries → `rpc` NOT called (builder path unchanged).

Model module mocking on `backend/src/__tests__/db.service.test.ts`.

**Verify**: `npm test` → exit 0 including the new suite.

### Step 5: Update SUPABASE-SETUP.md

Append both functions to the "Create Spatial Query Functions" section.

**Verify**: `grep -n "location_proofs_in_bbox_filtered" SUPABASE-SETUP.md` → ≥1 match.

## Test plan

Covered in Step 4 (unit, mocked rpc). Post-deploy operator check: an OGC
request `GET /api/ogc/collections/location-proofs/items?bbox=-180,-90,180,90&limit=5`
must return exactly 5 features with `numberMatched` equal to the table's
geometry-populated row count, and Supabase logs must show the `_filtered`
RPC being called rather than `location_proofs_in_bbox`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Migration file with both functions exists
- [ ] `grep -n "location_proofs_in_bbox'" backend/src/services/supabase.service.ts` → no matches (old RPC no longer called from the service; note the trailing quote in the pattern)
- [ ] `grep -c "location_proofs_in_bbox_filtered" backend/src/services/supabase.service.ts` → ≥1
- [ ] No `.sort(`/`.slice(`/`.filter(proof` remains between lines of the two bbox branches in `supabase.service.ts`
- [ ] `cd backend && npm run typecheck && npm run build && npm test` all exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 004's migration is not merged/applied — do not build on an unpopulated
  geometry column.
- The callers' expectations turn out to depend on the JS-filtered behavior in
  a way the SQL cannot reproduce (e.g. tests reveal the JS filter compared
  timestamps with different semantics than `event_timestamp >=`).
- You need to modify any controller or resolver to keep types compiling.
- `supabase-js`'s `.rpc()` cannot pass `TIMESTAMPTZ` nulls in your version —
  report the version and the error rather than switching parameter types
  blindly.

## Maintenance notes

- The old `location_proofs_in_bbox` stays for documented external consumers
  (`docs/spatial-queries.md`); consider deprecating it there in a docs pass.
- If cursor-based pagination is ever added, the `OFFSET` in the filtered
  function is the piece to replace.
- Reviewer should scrutinize: null-handling of optional filters (a filter
  accidentally defaulting to `''` instead of NULL silently returns zero
  rows), and that the 1000 cap matches the OGC validator's bound.
- Related index items deliberately not done here: the non-bbox path's missing
  default limit, and the GraphQL uncapped `filter.limit`.
