<!--
DRAFT, NOT POSTED. Proposed comment for DecentralizedGeo/astral-api#13.
The links point at branch docs/schema-agnostic-adr; switch them to main once that branch is merged.
Everything below the line is the comment body.
-->

---

The research phase for this issue is done, and the decision is written up as a proposed ADR:

**[ADR 0001: Schema-agnostic ingestion: discovery with an approval gate, and a shared compliance module](https://github.com/DecentralizedGeo/astral-api/blob/docs/schema-agnostic-adr/docs/adr/0001-schema-agnostic-ingestion.md)**

The evidence behind it is in the [research report](https://github.com/DecentralizedGeo/astral-api/blob/docs/schema-agnostic-adr/docs/research/2026-11-17-schema-agnostic-redesign.md). It covers a crawl of 12,151 schemas on 8 easscan indexers and a candidate query on all 16, which found 52 candidate schemas.

### In short

- **Don't configure schemas; discover them.**
  - An authenticated rescan (`POST /api/admin/schemas/rescan`) queries each chain for Location Protocol candidates.
  - A shared compliance module classifies each one: `compliant` (0.2 / 0.1), `legacy`, `near-compliant`, `missing-required` or `non-compliant`.
  - Every candidate goes into a `schemas` registry keyed by `(chain_id, uid)`.
- **Ingest only approved schemas.**
  - Compliant schemas from pinned UIDs or trusted creators are approved automatically; everything else waits for one admin approval.
  - This respects the spec's "pin trusted UIDs" advice and keeps spam schemas out of the index. Six zero-attestation `string test_<timestamp>` schemas already pass the v0.2 check.
  - Fully automatic ingestion is a config change later.
- **Store everything from approved schemas, and drop nothing.** Each attestation keeps its `schema_uid`, `spec_version`, raw `decoded_data` and a `validation_status` (`valid` / `normalized` / `invalid` / `undecodable`). This matters because 98% of attestations on the main v0.2 schema use `location_type: "geojson"`, which the spec's enum doesn't include.
- **One module owns "what is compliant".** It lives in the API for now, with no dependencies, and is meant to be extracted and adopted by the SDK. That replaces the SDK's validator, which is one spec generation behind (astral-sdk#42).

### How this answers the questions above

| Question | Answer in the ADR |
|---|---|
| 1. Where should chain/schema config live? | **Chains:** a small registry in code. **Schemas:** a database registry, filled by discovery and gated by approval. No env var per chain or schema. Closest to your Option D, with discovery instead of manual entry |
| 2. SDK ↔ API relationship | They share the compliance module, not each other. The API does not import the SDK (your Option C's coupling cost) |
| 4. How are schemas validated? | At runtime, on rescan, by schema shape: four base fields with exact names and types. Each attestation is validated individually at ingest |
| 5. How are chains configured? | A registry in code mapping `chain_id` → easscan GraphQL URL. RPC URLs can be added later if we read onchain (#19) |
| 6. Schema evolution | Three generations are handled side by side: pre-spec legacy, 0.1.0 and 0.2.0. Each record stores the raw payload and the rules version, so it can be renormalized when the spec changes |
| 7. Adding a chain | One registry entry and a rescan |
| 8. How do schema authors know their schema works? | Public `GET /api/v0/schemas?chain=&tier=&status=` shows the tier, the reasons and whether the schema is approved |
| 9. Existing deployments | The changes are additive for API consumers. Existing rows are backfilled as the legacy schema and keep being served |
| 10. Performance | One persisted cursor per (chain, schema), with small pages under one time budget per run. Discovery is one or two queries per chain |

Two things the original framing missed, which shape the design:
- **The coupling isn't only config.** The sync cursor (`MAX(timestamp)` per chain) and the `location_proofs` table are shaped around the one legacy schema.
- **The v0.2 spec renamed the required fields.** They are now `lp_version` / `location_type` (snake_case), not `specVersion` / `locationType`.

### Prerequisites and blockers

- **Stabilization:** done in code on `fix/stabilization` (#19). The redesign builds on its auth middleware, keyset pagination and revocation reconciliation.
- **Spec questions:** several compliance rules depend on questions the spec doesn't settle yet:
  - `lp_version` string vs `uint8`
  - the canonical v0.2 UID (the appendix quotes the 0.1 UID)
  - bare `geojson`
  - `EPSG:4326` normalization, and GeoJSON axis order
  - legacy schemas
  - pinning vs discovery
  - `location` serialization
  - the Solidity type rules.

  These will go to `location-protocol-spec` as an issue. Until they are answered, the ADR uses provisional rules, each isolated in the compliance module.

Feedback on the ADR is welcome here. If there are no objections, I'll treat this issue as answered by ADR 0001 and track implementation in follow-up issues, one per step in the ADR's implementation order.
