# Making the Astral API schema-agnostic: research report

**Date:** 2026-11-17
**Scope:** astral-api (`main` @ `cf3f342`), astral-sdk (`main` @ `9fdf311`, v0.2.0), Location Protocol spec (live site = `v0.2.0-rc.1`), and live EAS GraphQL indexers.
**Related issues:** astral-api#13; astral-sdk #40, #26, #45, #42.

**Method:** Three agents ran in parallel: one on the API code, one on the SDK code and its issues, and one on the spec plus live EAS queries. I re-checked their key claims against the source and the live spec.

---

## TL;DR

1. **The API is where most of the work is, and it is heavy.** The coupling to one schema UID is not just config. It runs through the ingestion loop, the sync cursor (which is derived from `MAX(timestamp)` per chain), and a database table shaped exactly like the legacy schema's columns, with no `schema_uid` column. This is close to a rewrite of the ingestion pipeline. The read APIs (REST, OGC, GraphQL) need moderate, additive changes.
2. **The SDK is a moderate refactor, not a redesign, and the API work does not depend on it.** Multi-schema config, per-call schema override and a compliance validator already exist (#40 and #42, merged in PR #49). What blocks real custom schemas is about 2 × 40 lines of hard-coded v0.1 field lists in the two `formatProofForEAS` functions, plus a v0.1-only attestation type. The SDK does not read from the Astral API, so the API redesign can ship on its own.
3. **The spec situation is messier than "v0.1 has no `specVersion`".** There are three generations onchain (details in [Finding 1](#finding-1--the-spec-has-three-onchain-generations-not-two)). The SDK's validator encodes the old spec 0.1 naming as "v0.2", so it is already out of date. **Settle what counts as canonical before writing the compliance checker.**
4. **Discovery is cheap and works today.** On 8 chains a full crawl took less than 25 s for 12,151 schemas. A server-side `contains` filter returns the same candidates in a single query per chain. Across the 16 live chains I found 52 candidate schemas; the 50 on the 8 crawled chains break down as 26 compliant v0.2, 6 compliant v0.1, 10 legacy, 8 near-compliant, plus 12 more variants that have no `srs` field.
5. **Schema-level compliance does not mean attestation-level validity.** About 98% of attestations on the main v0.2 schema (`0xde87be…`) use `location_type: "geojson"`, which is not in the v0.2 enum. The pipeline has to normalize and store a validation status for each attestation, not drop records.

---

## Finding 1 — The spec has three onchain generations, not two

| Generation | Version field | Field names | Example UID (same on many chains) | Attestations seen |
|---|---|---|---|---|
| **Legacy Astral** (before the spec) | none | `eventTimestamp, srs, locationType, location, recipeType[], recipePayload[], mediaType[], mediaData[], memo` | `0xba4171c9…24e2` (**the UID hard-coded in the API and SDK today**) | Base 556, Sepolia 340, Base-Sepolia 41, Arbitrum 8, Optimism 4, Celo 3 |
| **Spec 0.1.0** (tagged 2025-09-09) | `specVersion` (the spec says string `^\d+\.\d+$`; the recommended EAS string uses `uint8`) | camelCase: `srs, locationType, location` | `0xedd6b005…` (`string srs, string locationType, string location, uint8 specVersion`) | 6 schemas, Sepolia only, about 22 attestations total |
| **Spec 0.2.0-rc.1** (live site, 2026-02-24) | `lp_version` (string, semver `^\d+\.\d+\.\d+$`) | snake_case: `srs, location_type, location`; optional `event_timestamp, media_*, attributes, extensions, proof.stamps` | `0xde87be8a…ba81` (de facto, 9 chains); minimal base `0x3902cc7b…fffd` | Sepolia 472, Base-Sepolia 36, others ≈ 0 |

Points that affect the design:

- **The v0.2 spec renamed the required fields.** It uses `lp_version` / `location_type`, not `specVersion` / `locationType`; I checked this against the live data-model page. A check for "specVersion + srs + locationType + location" would match spec 0.1.0, not the current spec.
- **The spec's EAS appendix contradicts itself.**
  - It recommends `uint8 lp_version`, but the data model says `lp_version` is a semver string.
  - That recommended string is registered on no chain.
  - It quotes the 0.1 UID (`0xedd6b005`) as if it were the v0.2 one.
- **The spec advises pinning trusted UIDs rather than deriving them dynamically.** Auto-discovery runs against that advice, which is why Recommendation B below adds an approval or trust layer.
- **The SDK's `validateLocationProtocolSchema` (astral-sdk#42) is out of date.** It treats `uint8 specVersion` + camelCase as "v0.2" and its absence as "v0.1". Under the current spec that logic is one generation behind.
- **A schema-level check can verify:** field presence, names, Solidity types, duplicates, resolver and revocable.
- **Only an attestation-level check can verify:**
  - `lp_version` semver
  - the `srs` URI/URN form (the `EPSG:4326` short form is deprecated)
  - the `location_type` enum (the bare `geojson` value is no longer valid)
  - the shape of `location` for each type
  - `event_timestamp > 0`

## Finding 2 — How deep the coupling goes in astral-api

### Where it is hard-coded

- `backend/src/services/eas.service.ts:37-62` has one global `schemaUID` (env var, falling back to the literal `0xba4171…`). It is copied into a 4-chain `CHAIN_CONFIG`.
- `eas.service.ts:65` hard-codes the legacy `SCHEMA_STRING`.
- `config/index.ts` has one env var per chain plus one `EAS_SCHEMA_UID`.
- `config/EAS-config.json` is dead: nothing imports it.
- Chain lists are hard-coded again in:
  - `api/v0/controllers/config.controller.ts`
  - `location-proofs.controller.ts` (`/stats`)
  - `api/cron/sync.ts`
  - `sync.controller.ts`
- The UID also appears in about 8 docs.

### How attestations are fetched today

- **Query** (`eas.service.ts:245-268`): `attestations(where:{schemaId:{equals}, timeCreated:{gt}}, take:100, orderBy timeCreated asc)`.
- **One page per chain per run.** There is no pagination loop.
- **Rows can be dropped at page boundaries.** The `gt` comparison has no tiebreak, so a page boundary that falls inside one second drops the rest of that second.
- **Cursor:** `MAX(timestamp) WHERE chain=$1` from `location_proofs`, keyed per chain. There is no sync-state table.
  - **Consequence:** add a second schema on a chain that already has rows, and its history is skipped, because its cursor starts at the chain's latest timestamp.

### Decoder

- `convertAttestationToLocationProof` (`eas.service.ts:317-561`) reads the indexer's `decodedDataJson` and looks fields up **by name**. That part is good news.
- But it:
  - assumes the legacy names
  - **silently fills defaults** for missing fields (`srs='WGS84'`, `locationType='point'`)
  - ignores the version field
  - drops unknown fields
  - keeps only the **first coordinate** of any geometry

### Database

- `location_proofs` columns are the legacy schema's fields (`recipe_types`, `media_types`, `memo`, `event_timestamp NOT NULL`).
- There is no `schema_uid`, `spec_version`, raw decoded payload or validation status.
- The primary key is `uid` alone. Making the key `(chain, uid)` is safer once there are many schemas and chains.

### Read APIs

- REST v0, OGC Features and GraphQL filter only by chain, prover, subject, time and bbox, and return the legacy fields.
- All three need `schema_uid` / `spec_version` (and probably `validation_status`) in both their filters and their output.

### Problems found along the way

These are independent of the redesign but should be fixed first.

| # | Problem | Evidence | Impact |
|---|---|---|---|
| 1 | **The scheduled sync probably never runs.** Vercel cron sends `GET`, but the handler only accepts `POST`. | `cron/sync.ts:12-14`, `routes/index.ts:20`, `vercel.json:50-55` | Ingestion may only happen on manual triggers. Check the Vercel logs. |
| 2 | **An Infura API key is committed in source.** | `eas.service.ts:43-58` | **Rotate the key**, and move it to an env var (the RPC clients are vestigial anyway). |
| 3 | **Geometry is likely NULL in production.** The Supabase insert path writes no geometry, and no trigger fills it. | `supabase.service.ts:61-86` | bbox and spatial queries miss rows ingested through Supabase. |
| 4 | **The sync endpoints are unauthenticated.** | `sync.routes.ts`, no `CRON_SECRET` | A public "rescan" endpoint would be open to abuse. |
| 5 | **The only EAS test does not compile.** | `services/__tests__/eas.service.test.ts` (calls a removed method) | Effectively zero coverage of ingestion and decoding. |
| 6 | **Revocation checks are disabled and shallow.** | `cron/sync.ts:60-71` (commit `74fbb0a`) | Revoked attestations stay "valid". |

### Depth of change by layer

| Layer | Depth | Why |
|---|---|---|
| Config / chain registry | Light | Replace the per-chain env vars and the global UID with a chain registry (chain ID, GraphQL endpoint). Delete the dead JSON config. |
| Schema discovery and compliance (new) | Moderate | A new service, a new table, and a manual rescan endpoint. Logic is small; the parser and tier rules are well understood. |
| Ingestion loop | **Heavy** | It has to loop over (chain, schema) pairs, paginate properly with an `(timeCreated, id)` tiebreak, use small pages (EAS truncates responses over ~100 KB), and fit within serverless time limits through resumable batches. |
| Sync state | **Heavy** | It does not exist today. It needs a persistent cursor per (chain, schema), a cursor per chain for the schema crawl, and a revocation sweep. |
| Decoder / normalization | Moderate | Already name-based. It must map three generations onto one canonical model, stop inventing defaults, record a validation status, and keep full geometry plus the raw payload. |
| DB / migrations | Moderate–Heavy | New `schemas` and `sync_state` tables. Add `schema_uid`, `spec_version`, `decoded_data JSONB`, `validation_status`, and the `(chain, uid)` key to `location_proofs`. Backfill existing rows with `0xba4171`. Fix the geometry write. |
| REST / OGC / GraphQL | Moderate | Additive fields and filters across 3 surfaces. `/config` and `/stats` should read from the DB. |
| Tests / docs | Moderate | Coverage is starting from zero. The UID needs removing from about 8 docs. |

## Finding 3 — Depth of change in astral-sdk

| Area | Depth | Notes |
|---|---|---|
| Config / registry | Light–Moderate | `core/config.ts` has one `'v0.1'` block with one UID per chain. Chain maps are duplicated in `OnchainRegistrar` and `ComputeModule`. Pairs with #41 (custom chains). |
| **Encoding** | **Moderate** | `OffchainSigner.formatProofForEAS` and `OnchainRegistrar.formatProofForEAS` build a fixed 9-field legacy list in legacy order. EAS `encodeData` then throws for any schema shaped differently. **This is why #40 is only cosmetic today and #26 is still blocked.** A generic, schema-driven `encodeLocationProof` already exists in `src/eas/SchemaEncoder.ts` but nothing uses it. |
| Decoding | Light–Moderate | `LocationSchemaExtension` pins decoding to the legacy string. Switching it to the generic `decodeLocationProof` with a per-call schema is straightforward. |
| Types | Moderate (breaking) | `UnsignedLocationAttestation` is exactly the legacy field set. It needs a version field, `schemaUid`, `chainId`, an extra-fields bag, and optional legacy-only fields. |
| Validator (#42) | Light, but urgent | It is reusable as-is for the API's compliance check, **but its version logic matches spec 0.1.0, not 0.2.0-rc.1.** It needs updating to recognize `lp_version`, `location_type` and the snake_case fields. |
| API client | Light | `AstralApiClient` points at stale paths (`/proofs`), and **nothing in `AstralSDK` calls it**. Realign it or remove it. |
| Workflows | Light | The schema plumbing already exists. They just need the new encoder. |
| Tests / docs | Moderate | No test signs, registers or decodes with a non-legacy schema. **#45 was closed by mistake**: PR #61's "Closes #45" referred to something else, and `docs/guides/custom-schemas.md` does not exist. |

### Issue map

| Issue | Status | Relation to this redesign |
|---|---|---|
| astral-api#13 | Open, no comments | Its line references are correct, but it frames the problem as "where should config live" (Options A–E). It misses the DB and cursor coupling, the dead config file and the spec's field rename. Discovery is mentioned only in passing. **Update it, or supersede it with an ADR.** |
| astral-sdk#40 Multi-schema | Open | Config, override and cache are done. The encoder hard-coding makes it ineffective. It is the SDK's write-side counterpart to this redesign, **not a prerequisite** for it. |
| astral-sdk#26 Custom payload fields | Open (P1) | The same root cause as #40, seen by users. Becomes more urgent once the API serves attestations with extra fields. |
| astral-sdk#42 Validator | Closed | **A direct enabler.** Needs updating to spec 0.2.0-rc.1 naming. |
| astral-sdk#45 Custom-schemas guide | Closed (by mistake) | Reopen it. It depends on #40 actually working. |

**Is the "heavy overhaul of both" hypothesis right?** Half. **The API: yes.** **The SDK: no.** The SDK needs a contained, moderate refactor, and the API redesign does not depend on it. The one real point of coupling is *agreement on what "compliant" means*, which argues for a shared compliance module (see Recommendation D).

## Finding 4 — EAS discovery: what works in practice

- **Endpoints.**
  - 16 live easscan GraphQL endpoints: mainnet, sepolia, arbitrum, arbitrum-nova, base, base-sepolia, optimism, optimism-sepolia, scroll, polygon, linea, celo, zksync, telos, soneium, ink.
  - The docs list `optimism-sepolia-bedrock.easscan.org`, which does not resolve; the working host is `optimism-sepolia.easscan.org`.
  - Several testnets were returning a 502 maintenance page.
- **API features.** It is a Prisma/TypeGraphQL backend. `StringFilter` supports `contains` and `mode: insensitive`, plus `AND`/`OR`/`NOT`. `cursor:{id}` pagination is available. `_count{attestations}` is available on schemas, and schema names are queryable.
- **Candidate filter** (one query per chain; it matched the full crawl exactly for schemas containing `srs`):
  ```graphql
  query($take:Int,$skip:Int){
    schemata(where:{AND:[{schema:{contains:"srs",mode:insensitive}},
                         {schema:{contains:"location",mode:insensitive}}]},
             orderBy:{time:asc}, take:$take, skip:$skip){
      id schema creator resolver revocable time _count{attestations} schemaNames{name}
    }
  }
  ```
  It misses the 12 variants that have no `srs` field. A second `OR` query on `locationType` / `location_type` / `lp_version` covers those.
- **Incremental attestation sync** (verified):
  ```graphql
  query($ids:[String!],$since:Int!,$take:Int!){
    attestations(where:{schemaId:{in:$ids}, timeCreated:{gt:$since}},
                 orderBy:[{timeCreated:asc},{id:asc}], take:$take){
      id schemaId attester recipient time timeCreated revoked revocationTime
      isOffchain txid decodedDataJson
    }
  }
  ```
  - Use `timeCreated` (when the indexer stored the record) as the watermark, not `time`.
  - Revocations need their own sweep: `revocationTime:{gt:$since}`.
- **Reliability.**
  - Responses over about 100 KB are often truncated mid-stream.
  - Keep schema pages to about 300 rows or fewer, and attestation pages with `decodedDataJson` to about 30 rows.
  - Retry with backoff.
  - There are no rate-limit headers, and I saw no 429s across about 200 sequential calls (I did not load-test).
- **Spam.** There are 0-attestation `…string test_177…` schemas that technically pass the v0.2 check. Store the creator and attestation count so they can be suppressed.
- **Cache key.** Key schemas on `(chainId, uid)`. The UID hashes the schema string, resolver and revocable flag, so the same UID shows up on many chains.

---

## Recommendations

Each option builds on a common core, which is effectively required by every path:

- a `schemas` registry table
- a sync cursor per (chain, schema)
- `location_proofs` gains `schema_uid`, `spec_version`, `decoded_data`, `validation_status`, and the `(chain, uid)` key
- a normalizer that maps the three generations onto the canonical v0.2 model

### A. Auto-discovery with tiered compliance (closest to what you proposed)

1. Add an authenticated endpoint, `POST /api/admin/schemas/rescan`, that crawls every configured chain using the `contains` filter plus the no-`srs` fallback query.
2. Parse each schema and assign a tier:
   - `compliant-v0.2`
   - `compliant-v0.1`
   - `compliant-legacy`
   - `near-compliant`
   - `missing-required`
   - `non-compliant`
3. Upsert the results into `schemas`.
4. Ingest attestations from all *compliant* tiers automatically. Near-compliant schemas are recorded and exposed (for example `GET /schemas?tier=near`) but not ingested.

- **Pros:** fully schema-agnostic; does what you described; near-compliance is visible.
- **Cons:** runs against the spec's "pin trusted UIDs" advice; spam schemas get ingested unless filtered; anyone can register a compliant schema and inject data into the index.

### B. Discovery with an approval gate (recommended)

Same crawl and tiering as A, plus:

- Each schema row gets a `status`: `discovered`, `approved` or `rejected`.
- Only `approved` schemas are ingested.
- Compliant schemas from trusted creators (an allowlist, e.g. the `0x3074C873…` creator of `0xde87be`) and `0xba4171` are approved automatically. Everything else waits for one admin approval.

- **Pros:**
  - Gives the schema agnosticism you want while respecting the spec's trust guidance.
  - Keeps the index clean (no `test_…` spam).
  - Manual approval fits naturally with the "manually triggered rescan" first iteration.
  - Going fully automatic later is just a config flip (approve automatically by tier).
- **Cons:** one human step per new schema. At current volumes (about 50 candidates across all chains), that is trivial.

### C. Query attestations by schema string, with no UID cache (cheap interim)

Skip the registry. Query `attestations(where:{schema:{is:{AND:[{schema:{contains:"srs"}},{schema:{contains:"location"}}]}}, timeCreated:{gt}})` directly, and classify each attestation's schema as it arrives.

- **Pros:** smallest change; no rescan step.
- **Cons:**
  - An unindexed `contains` join on every sync (slower, and fragile with the response-size truncation).
  - No place to record near-compliant schemas.
  - Weak control over spam.
  - You would probably end up building the registry anyway.
  - Only worth it as a stopgap if something has to ship before the registry is ready.

### D. Shared compliance package (do this whichever of A–C you pick)

Extract the schema parser, tier classifier and canonical normalizer into one package (for example `@decentralizedgeo/lp-compliance`, or a module inside astral-sdk that the API imports). Start from the SDK's `validateLocationProtocolSchema` and update it to spec 0.2.0-rc.1.

- **Pros:** the SDK, the API and future clients agree on what "compliant" means. Fixes the out-of-date validator once.
- **Cons:** one more thing to publish and version.

### E. Onchain `SchemaRegistry.Registered` logs (later, optional)

Read schema registrations from the chain over RPC instead of easscan.

- **Pros:** trustless; covers chains easscan doesn't index or that are under maintenance.
- **Cons:**
  - Needs RPCs and log paging for each chain.
  - The event signature differs between EAS versions (v0.26 vs v1.x).
  - No attestation counts or decoding.
- **Verdict:** worth it only if independence from easscan matters.

**My pick: B + D, with a stabilization pass first.** A is B with the gate turned off, so choosing B costs nothing in flexibility.

---

## Suggested next steps

1. **Stabilize the API first** (one PR, independent of the redesign):
   - Accept `GET` with a `CRON_SECRET` on the cron route.
   - Rotate the committed Infura key.
   - Write geometry on the Supabase path.
   - Authenticate the `/sync` routes.
   - Fix or remove the broken EAS test.
   - Check in the Vercel logs whether the cron has actually been running.
2. **Settle the spec questions.** Do this with the spec authors, as an issue on location-protocol-spec:
   - Is `lp_version` a string or `uint8`?
   - Which UID is canonical for v0.2?
   - Fix the appendix.
   - Is bare `geojson` an accepted alias for `location_type`?
   - Should the deprecated `EPSG:4326` short form of `srs` be normalized?

   The compliance tiers depend on these answers.
3. **Write an ADR** for options B + D, and update or close astral-api#13 against it.
4. **Build the shared compliance module (D):** a parser, a tier classifier and a v0.1/legacy → v0.2 normalizer. Write unit tests against the 52 real schema strings from this research (`eas-research/classified.tsv`, linked under Artifacts below).
5. **Migration:** `schemas` + `sync_state` tables; new columns on `location_proofs`; backfill existing rows with `0xba4171`.
6. **Schema discovery service** + `POST /api/admin/schemas/rescan` (manual for now) + `GET /api/v0/schemas`.
7. **Rewrite the ingestion loop:**
   - Iterate over (chain, approved schema).
   - Use a `(timeCreated, id)` cursor with pages of 30 or fewer, resumable within a time budget.
   - Add a revocation sweep.
8. **Decoder → normalizer:** store `decoded_data`, `validation_status` and errors, and full geometry.
9. **Read APIs:** add `schema_uid`, `spec_version` and `validation_status` filters and fields to REST, OGC and GraphQL. Make `/config` and `/stats` read from the DB.
10. **SDK, in parallel and not blocking:**
    - Switch `formatProofForEAS` to the generic encoder.
    - Widen the attestation types.
    - Use the shared validator.
    - Realign or drop `AstralApiClient`.
    - Reopen #45 and write the guide.

    This finishes #40 and #26.
11. **Later:** a scheduled rescan via cron (Vercel's Hobby plan only allows daily crons, which is fine for schemas; attestation sync needs a paid plan or an external scheduler), automatic approval by tier, and the option of onchain discovery (E).

### Artifacts from this research (session scratchpad, not durable)

- Candidate schemas across chains, classified: `/tmp/claude-1000/-home-danny-Projects-astral-api/8cf2ae50-ee3f-4775-9245-edad925aceec/scratchpad/eas-research/classified.tsv`
- Crawl, classifier and value-sampling scripts: same directory (`crawl.mjs`, `classify.mjs`, `values.mjs`)
- SDK clone that was analyzed: `/tmp/claude-1000/-home-danny-Projects-astral-api/8cf2ae50-ee3f-4775-9245-edad925aceec/scratchpad/astral-sdk`

Copy `classified.tsv` into the repo before the scratchpad is cleared if you want it as test fixtures.
