---
status: proposed
date: 2026-11-17
issues: "#13 (redesign), #19 (stabilization, prerequisite)"
---

# 0001 — Schema-agnostic ingestion: discovery with an approval gate, and a shared compliance module

## Context

The API indexes Location Protocol attestations from EAS GraphQL indexers, but only for one hard-coded schema (`0xba4171c9…24e2`, the pre-spec Astral schema) on four chains. That UID is built into the ingestion loop, the sync cursor and the shape of the `location_proofs` table. Meanwhile, people attest location under many other schemas:

- **Three generations onchain:** pre-spec legacy (no version field, camelCase), spec 0.1.0 (`specVersion`, camelCase) and spec 0.2.0-rc.1 (`lp_version`, snake_case).
- **52 candidate schemas** across the 16 live easscan indexers. The de facto v0.2 schema, `0xde87be8a…ba81`, is registered on 10 chains.
- **Schema conformance does not imply payload validity.** 98% of `0xde87be` attestations use `location_type: "geojson"`, which is not in the v0.2 enum.
- **The spec is ambiguous or self-contradictory in places this design depends on** (see [Open questions](#open-questions)).

The evidence is in the [research report](../research/2026-11-17-schema-agnostic-redesign.md); the raw schema data is in `backend/tests/fixtures/eas-schemas/`.

This ADR builds on the stabilization work for #19 on `fix/stabilization`:
- bearer auth on the sync routes (`requireBearerToken`)
- the Vercel cron fix
- the geometry trigger (migration `004`)
- revocation reconciliation
- keyset `(timeCreated, id)` ingestion with a time budget.

It does not revisit any of those.

## Decision

We will make ingestion schema-agnostic in the following way. This is **option B + option D** in the research report.

1. **Discover** candidate schemas on every configured chain through a manually triggered, authenticated rescan.
2. **Classify** each schema into a compliance tier with a shared compliance module.
3. **Record** every candidate in a `schemas` registry.
4. **Ingest** only from schemas whose status is `approved`. Approval is automatic for compliant schemas from trusted UIDs or creators, and manual for everything else.

The compliance module (the schema parser, tier classifier and attestation normalizer) is a single, dependency-free module. It is the only place that encodes Location Protocol rules, so the API, the SDK and future clients can share it.

Every attestation from an approved schema is stored, along with its raw decoded payload and a validation status. **Nothing is silently dropped or filled with invented defaults.**

Option A (ingest everything compliant automatically) is option B with the gate always open. Choosing B keeps A available as a configuration change.

### Data model

All new and changed tables key chains by EIP-155 `chain_id` (integer). The existing `chain` slug (`base`, `sepolia`, …) stays on `location_proofs` as a display and filter column so the read APIs do not break. A chain registry in code maps `chain_id` ↔ slug ↔ easscan GraphQL URL, replacing the per-chain env vars, `CHAIN_CONFIG` and the dead `config/EAS-config.json`.

#### `schemas` (new): the registry

Primary key `(chain_id, uid)`. A schema UID hashes the schema string, resolver and `revocable` flag, so the same UID appears on many chains. Each chain has its own row, because attestation counts, creators and approval are per chain.

| Column | Notes |
|---|---|
| `chain_id`, `uid` | Primary key |
| `schema` | Raw schema string, exactly as registered |
| `creator`, `resolver`, `revocable` | From EAS. `creator` drives the trusted-creator rule; `resolver` and `revocable` are shown so admins can judge the schema |
| `registered_at`, `registration_tx` | From EAS `time` and `txid` |
| `names` | EAS `schemaNames`, if any |
| `attestation_count`, `attestation_count_at` | Updated on every rescan. Used to spot spam (e.g. zero-attestation `string test_<timestamp>` schemas) |
| `tier` | From the compliance module (see [Compliance tiers](#compliance-tiers)) |
| `generation` | `legacy`, `0.1` or `0.2`: which mapping the normalizer applies |
| `classification_notes` | JSONB: the module's reasons, e.g. `type mismatch location:bytes` |
| `rules_version` | Version of the compliance rules that produced `tier`. Lets us find rows to reclassify when the rules change |
| `status` | `discovered`, `approved` or `rejected` |
| `status_reason`, `status_changed_at`, `status_changed_by` | Audit trail for the approval gate. `status_changed_by` is `auto:<rule>` or an admin label |
| `first_seen_at`, `last_seen_at` | Rescan bookkeeping |

Rules for the approval gate:

- **A new row starts as `discovered`.** It is set to `approved` with `status_changed_by = 'auto:…'` only if both:
  - its tier is ingestible (`compliant` or `legacy`; see [Compliance tiers](#compliance-tiers)), and
  - its UID is on the pinned-UID allowlist or its creator is on the trusted-creator allowlist.

  Both allowlists live in code (reviewed by PR), not in env vars.
- **A rescan never changes an `approved` or `rejected` status.** It updates `tier`, the counts and `last_seen_at`. If an approved schema's tier is no longer ingestible (after a rules change, say), the rescan reports the mismatch for an admin to act on. Ingestion does not stop on its own.
- **`near-compliant`, `missing-required` and `non-compliant` schemas are never approved in v1.** They are recorded so they are visible, e.g. to authors checking why their schema isn't indexed.

#### `sync_state` (new): a cursor for each (chain, schema)

This generalizes the `(timeCreated, id)` keyset cursor that `fix/stabilization` introduced. That cursor is kept in memory and, on cold start, rebuilt from `MAX(timestamp)` across all rows on a chain.

| Column | Notes |
|---|---|
| `chain_id`, `schema_uid` | Primary key; foreign key to `schemas` |
| `time_created`, `last_id` | Exclusive keyset position: the next page starts strictly after `(time_created, last_id)` |
| `backfill_complete` | False until the first run reaches the head of the stream |
| `last_run_at`, `last_success_at`, `last_error` | Run bookkeeping |
| `stored_count`, `skipped_count` | Running totals for `/stats` and debugging |

Semantics:

- **The cursor is persisted after each page is stored.** It advances only past attestations that were stored or already present, the same rule as today. Inserts are idempotent upserts on `(chain_id, uid)`, so replaying a page after a crash does no harm.
- **A newly approved schema starts at `time_created = 0`.** It gets its full history, which fixes the current bug where a second schema on a chain would inherit that chain's latest timestamp and skip its own history.
- **Each run iterates over approved `(chain, schema)` pairs, least recently synced first, under one total time budget** (`INGEST_TIME_BUDGET_MS`). A large backfill cannot starve the other schemas. Page size stays at 30 or fewer, because easscan truncates responses over about 100 KB.
- **Revocation reconciliation**, as built on `fix/stabilization`, runs per `(chain, schema)` instead of per chain. It scans the authoritative revoked set, then flags or clears stored rows. It needs no cursor while revoked counts are small.
- **The schema rescan needs no cursor.** One or two candidate queries per chain return the whole candidate set (52 rows across all chains today).

#### `location_proofs` (changed)

| Change | Notes |
|---|---|
| Add `chain_id` | Filled from the chain registry for existing rows |
| Primary key `uid` → `(chain_id, uid)` | Attestation UIDs are only unique per chain |
| Add `schema_uid` | Foreign key `(chain_id, schema_uid)` → `schemas` |
| Add `spec_version` | The spec version the payload declares, after normalization (`0.2.0`, `0.1.0`), or `legacy`. Open, depends on Q1 and Q5 |
| Add `decoded_data` JSONB | EAS `decodedDataJson`, stored as-is. Lossless: extra and unknown fields survive, and records can be renormalized later without re-fetching |
| Add `validation_status` | `valid`, `normalized`, `invalid` or `undecodable` (see [Compliance tiers](#compliance-tiers)) |
| Add `validation_errors` JSONB, `rules_version` | What failed or was rewritten, and under which rules |
| Relax `NOT NULL` on `event_timestamp`, `location_type`, `location` | `event_timestamp` is optional in v0.2, and invalid or undecodable records have no payload |
| Geometry | The normalizer writes full geometry (polygons and lines, not just the first coordinate) from the parsed `location`. The `004` trigger keeps filling `geometry` from `longitude`/`latitude` when it is NULL |

The legacy-shaped columns (`recipe_types`, `media_types`, `memo`, …) stay for compatibility and are filled from the normalized payload where a mapping exists. The canonical record is the normalized payload plus `decoded_data`.

**Backfill.** Existing rows get `schema_uid = 0xba4171…`, `spec_version = 'legacy'` and `chain_id` in SQL. `decoded_data` is not stored today, so it is filled by resetting the `0xba4171` cursors to 0 and re-ingesting. The idempotent upsert fills the new columns, which also stores the 133 Base attestations with an empty `decodedDataJson` that `fix/stabilization` now skips; they come back as `undecodable`.

Migrations continue the existing sequence (`005_…` onward). The Supabase fallback write path has to support the same upsert, or be removed. That choice is left to implementation.

### Compliance tiers

The compliance module assigns these schema-level tiers. "Ingestible" means the auto-approve rule may approve the schema.

| Tier | Rule (provisional where marked) | Ingestible |
|---|---|---|
| `compliant` (generation `0.2`) | Contains `string lp_version`, `string srs`, `string location_type`, `string location`; names exact and case-sensitive; no duplicates; any order; extra fields allowed. **Open: Q1** decides whether `uint8 lp_version` also qualifies; **Q8** fixes the type rules | Yes |
| `compliant` (generation `0.1`) | `specVersion`, `srs`, `locationType`, `location`, with `uint8 specVersion` accepted (as 0.1.0's appendix recommended) | Yes |
| `legacy` | No version field; `srs`, `locationType`, `location` as `string`. Covers `0xba4171` and its variants. **Open: Q5** decides whether the spec acknowledges this generation at all | Yes |
| `near-compliant` | All base-field roles present, but with a wrong Solidity type (`bytes location`, `uint40[] location`, `string[] location`, `unit8 specVersion`) or names that match only after ignoring case and underscores | No |
| `missing-required` | Has `location` and one of `srs` or `location_type`, but not both | No |
| `non-compliant` | Everything else that the candidate query returned | No |

Attestation-level `validation_status`:

| Status | Meaning |
|---|---|
| `valid` | Passes the base-field validation for its generation with no rewriting |
| `normalized` | Valid after documented rewrites, each recorded in `validation_errors` as a warning. The provisional rewrites are: <br>• bare `geojson` → `geojson-<geometry>` (**open: Q3**) <br>• `EPSG:4326`-style short form → URI (**open: Q4**) <br>• `lp_version: "1.0.0"` → `0.2.0` (**open: Q1**) <br>• the legacy/0.1 field mapping (**open: Q5**) |
| `invalid` | Decodes, but fails base-field validation after normalization, e.g. a missing `location` or an unparseable `location` for its `location_type` |
| `undecodable` | EAS returned an empty `decodedDataJson` |

Read APIs return `valid` and `normalized` records by default; `invalid` and `undecodable` are returned only when asked for explicitly. Because existing legacy rows normalize to `normalized`, current API consumers keep seeing the same records.

### Shared compliance module (option D)

- **What it is.** It lives at `backend/src/compliance/` as a self-contained module with no imports from the API's services, database or config. Its interface:
  - `parseSchema(schemaString)` → fields
  - `classifySchema(fields)` → `{ tier, generation, notes }`
  - `normalizeAttestation(decodedData, generation)` → `{ payload, status, errors, warnings }`
  - `RULES_VERSION`
- **How it is tested.** Unit tests run against every real schema in `backend/tests/fixtures/eas-schemas/`.
- **Every rule that depends on an open spec question is isolated in this module, behind a named rule.** Settling a question then means one change, plus a `RULES_VERSION` bump to drive reclassification.
- **Why it isn't a published package yet.** The module is shaped to be extracted later (for example as `@decentralizedgeo/lp-compliance`), but not before the spec questions settle. Publishing rules that are still provisional would spread them to the SDK before they are right.
- **The API does not import astral-sdk to get these rules.** The SDK carries ethers and the EAS SDK, and the API would be tied to the SDK's release schedule. This is issue #13's option C, and its coupling cost is the reason.

### Rescan and admin endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/admin/schemas/rescan` | `requireBearerToken('SYNC_ADMIN_TOKEN')`, same as the mutating `/api/sync` routes; fails closed with 503 when unset | Takes an optional `{ "chains": [chainId…] }` and runs the candidate queries on each registry chain: `srs` + `location`, plus a fallback on `location_type`, `locationType` and `lp_version` for schemas without `srs`. Classifies and upserts into `schemas`, applies the auto-approve rule, and returns per-chain counts (new, tier changed, auto-approved, needs review). Runs synchronously; a full rescan finished in well under the function limit in research |
| `POST /api/admin/schemas/:chainId/:uid/approve` and `…/reject` | Same | Body `{ "reason": "…" }`. Sets the status and records the audit columns. Approving creates the `sync_state` row at cursor 0 |
| `GET /api/v0/schemas` | Public | Filters: `chain`, `tier`, `status`. Answers #13's question 8, "how do schema authors find out if their schema works?" |

There is no scheduled rescan in v1. When one is added, it gets a cron entry that accepts `CRON_SECRET`, the way `/api/cron/sync` does today.

### Read APIs

The changes are additive across REST v0, OGC API Features and GraphQL:
- `schema_uid`, `spec_version` and `validation_status` as output fields and filters
- `decoded_data` returned on single-record endpoints
- `/config` and `/stats` read chains and schemas from the database instead of hard-coded lists.

### Relation to astral-sdk issues

| Issue | Relation |
|---|---|
| **#42** Schema validation utility (closed) | Its `validateLocationProtocolSchema` treats `uint8 specVersion` + camelCase as "v0.2", which is spec 0.1.0. The compliance module replaces it. The SDK should adopt the module once it is extracted, rather than patching the validator separately. Until then, the two disagree, and the API's classification is the reference |
| **#40** Multi-schema support (open) | The write-side counterpart to this ADR, **not a prerequisite**: the API does not depend on the SDK. #40 is cosmetic until the SDK's `formatProofForEAS` stops hard-coding the legacy field list. When it lands, SDK users can attest with any schema this registry approves |
| **#26** Custom payload fields (open, P1) | The API side is covered by `decoded_data`: extra fields are stored and served. The SDK side has the same root cause as #40 (the hard-coded encoder) and stays open there |
| **#45** Custom-schemas guide (closed by mistake) | Should be reopened. The guide should point schema authors at the compliance rules and at `GET /api/v0/schemas` to check whether their schema is recognized and approved |

## Considered options

- **A. Auto-discovery, ingest every compliant schema automatically.**
  - Not chosen as the default. It ignores the spec's advice to pin trusted UIDs, and it lets anyone write records into the index by registering a shape-conformant schema; six zero-attestation `test_…` schemas already pass the v0.2 check.
  - It stays available: auto-approving by tier is a config change on top of B.
- **C. No registry: query attestations directly by schema-string `contains` and classify on arrival.**
  - Rejected. It costs an unindexed join on every sync, which is fragile under easscan's response truncation. It leaves no place to record near-compliant schemas or approval decisions, and gives no control over spam. We would end up building the registry anyway.
- **E. Discover schemas from onchain `SchemaRegistry.Registered` logs.**
  - Deferred, not rejected. It is trustless and covers chains easscan doesn't index, but it needs RPC endpoints and per-chain log paging, the event signature differs between EAS versions, and it provides no attestation counts or decoding.
  - Worth revisiting if independence from easscan becomes a requirement. The chain registry is shaped so RPC URLs can be added later (#19, item 2).
- **One cursor per chain with `schemaId: { in: [...] }`.**
  - Rejected. It saves queries but couples every schema's progress on a chain: approving a new schema would need a separate backfill path anyway.
- **Drop attestations that fail validation, as today's decoder effectively does.**
  - Rejected. With 98% of the main v0.2 schema's attestations using a non-enum `location_type`, dropping would discard most real data on the strength of spec rules that are still open.

## Consequences

**Positive**

- New conformant schemas and chains need a rescan and, at most, one approval, not a code change. That meets #13's main success criterion.
- Every stored record carries its schema, generation, raw payload and validation outcome. When the spec questions are settled, we renormalize from the database instead of re-crawling.
- One module owns "what is compliant", so the API and the SDK can stop disagreeing.

**Negative / costs**

- Changing the primary key of `location_proofs` to `(chain_id, uid)` touches every write path, including the Supabase fallback, and any consumer that assumed `uid` alone is unique.
- Each new non-allowlisted schema needs a human approval: trivial at about 50 candidates, a chore if volume grows.
- Ingestion time is now shared across more `(chain, schema)` pairs within the same serverless budget. Backfills take several runs, and a minute-level cron needs a paid Vercel plan or an external scheduler.
- Until the module is extracted, the SDK's validator (#42) stays out of date and disagrees with the API.

## Open questions

### Blocked on the spec

These are drafted for `location-protocol-spec` in [`docs/drafts/location-protocol-spec-issue-compliance-questions.md`](../drafts/location-protocol-spec-issue-compliance-questions.md); the draft has not been posted yet. Each answer changes a specific part of this ADR. Until then, the provisional answer is implemented as a named rule in the compliance module.

| # | Question | What it decides here | Provisional rule |
|---|---|---|---|
| Q1 | `lp_version`: `string` or `uint8`, and is `"1.0.0"` a valid v0.2 value? | Whether `uint8 lp_version` schemas are `compliant`. `spec_version` for about 530 `"1.0.0"` payloads | `string` only. `"1.0.0"` → `normalized` as `0.2.0` |
| Q2 | Which UID is canonical for v0.2? | The initial pinned-UID allowlist; docs | Pin `0x3902cc7b…fffd` and `0xde87be8a…ba81`, plus `0xba4171c9…24e2` (legacy, already indexed) |
| Q3 | Is bare `geojson` an alias? | `valid`/`normalized` vs `invalid` for 98% of `0xde87be` | Alias, resolved from the geometry type → `normalized` |
| Q4 | Normalize `EPSG:4326`? GeoJSON axis order under an EPSG:4326 `srs`? | Status of most legacy and 0.1 records. **Stored geometry for every `0xde87be` record** | Map short forms → `normalized`. GeoJSON is always lon/lat |
| Q5 | How are pre-spec legacy schemas treated? | Whether the `legacy` tier exists and is ingestible; `spec_version` label | `legacy` tier, ingestible, `spec_version = 'legacy'` |
| Q6 | Does "pin trusted UIDs" forbid discovery? | Defaults of the approval gate, not its existence | Gate on; auto-approve only allowlisted UIDs and creators |
| Q7 | How is a non-string `location` serialized in EAS? | The `location` parser for `coordinate-decimal` and similar types | JSON text first, then the legacy comma forms with the generation's axis order |
| Q8 | Which Solidity types and names make a schema conformant? | The `compliant`/`near-compliant` boundary | All four base fields `string`, names exact |

### Not spec questions: decide during implementation

- **Trusted-creator allowlist.** `0x3074C873…DdB9` registered `0xde87be` (on all 10 chains), and registered `0x3902cc7b`, `0x7e142d0c` and `0xedd6b005` on at least one chain each. Confirm it is an Astral/DecentralizedGeo key before allowlisting it.
- **Which chains are in the registry for v1.** All 16 live easscan endpoints, or only those with candidates? Ten currently have at least one.
- **Supabase fallback write path.** Keep it with matching upsert semantics, or remove it.
- **Scheduling.** Vercel plan and cron frequency for ingestion; schema rescans stay manual for now.

## Implementation order

Each step is a separate PR:

1. Compliance module, with fixture-driven tests.
2. Migrations: `schemas`, `sync_state`, the `location_proofs` columns and key, and the SQL part of the backfill.
3. Chain registry, replacing `CHAIN_CONFIG`, the per-chain env vars and `EAS-config.json`.
4. Discovery service, the rescan, approve and reject endpoints, and `GET /api/v0/schemas`.
5. Ingestion loop over `(chain, approved schema)` with persisted cursors, the normalizer in the write path, and per-schema revocation reconciliation. Then re-ingest `0xba4171` to fill `decoded_data`.
6. Read API fields and filters, and `/config` and `/stats` from the database.
7. Docs: remove the hard-coded UID from about 8 docs.
