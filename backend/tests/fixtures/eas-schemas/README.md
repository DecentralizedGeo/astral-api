# EAS schema fixtures

Real EAS schema strings collected from the easscan GraphQL indexers on 2026-11-17, during the research for the schema-agnostic redesign ([report](../../../../docs/research/2026-11-17-schema-agnostic-redesign.md), [ADR 0001](../../../../docs/adr/0001-schema-agnostic-ingestion.md)). Use them as test fixtures for the schema parser and compliance classifier, so tests run against what is actually registered onchain, not only against hand-written strings.

Nothing here is read at runtime.

## Files

### `classified.tsv`

One row per candidate schema on the 8 chains that were fully crawled: arbitrum, base, base-sepolia, celo, mainnet (`easscan.org`), optimism, optimism-sepolia and sepolia. The crawl read every registered schema (12,151 in total) and kept those the research classifier did not rate `non-compliant`.

| Column | Meaning |
|---|---|
| `chain` | easscan host without `.easscan.org` (`easscan.org` = Ethereum mainnet) |
| `schema_uid` | EAS schema UID. The same UID can appear on several chains |
| `attestation_count` | `_count.attestations` at crawl time |
| `tier` | Label from the research classifier (`docs/research/2026-11-17-eas-crawl/classify.mjs`) |
| `notes` | Classifier notes, e.g. the type mismatch that made a schema near-compliant |
| `schema` | The raw schema string, unmodified (whitespace and typos such as `unit8` kept) |

Counts by tier: 26 `compliant-v0.2`, 6 `compliant-v0.1 (uint version, per spec appendix)`, 10 `compliant-legacy-noversion`, 8 `near-compliant`, 12 `missing-required`.

**The `tier` column is the research classifier's opinion, not settled truth.** Several of the rules it encodes depend on open spec questions (see ADR 0001, "Open questions"). Tests should assert the tiers the final classifier is meant to produce, and treat this column as a starting point.

### `candidates/<host>.json`

The raw response of the candidate query (schema contains both `srs` and `location`, case-insensitive) on each of the 16 live easscan endpoints, 52 schemas in total. Unlike `classified.tsv`, each record includes `creator`, `resolver`, `revocable`, `time`, `txid` and `schemaNames`, so these files suit tests for the registry upsert and the trusted-creator rule. Endpoints with no candidates hold an empty list.

This query misses schemas without an `srs` field; `classified.tsv` has those (the `missing-required` rows) for the 8 crawled chains.

## Provenance

The crawl, classifier and value-sampling scripts are in `docs/research/2026-11-17-eas-crawl/`. They are research scripts, kept for reproducibility, not production code.
