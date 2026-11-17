# EAS crawl scripts (research, 2026-11-17)

Scripts used for the [schema-agnostic redesign report](../2026-11-17-schema-agnostic-redesign.md). Kept for reproducibility; they are not production code and are not covered by lint or tests.

- `crawl.mjs <host>...`: pages through every schema on each easscan host (`schemata`, cursor pagination, 250 per page) and writes `crawl/<host>.json`.
- `classify.mjs`: parses each crawled schema string and assigns a research tier. Prints the TSV that became `backend/tests/fixtures/eas-schemas/classified.tsv`, and the per-host counts in `summary.json`.
- `values.mjs`: pages through all attestations of a few schemas (30 per page) and tallies the values of `srs`, `location_type`/`locationType`, `lp_version`/`specVersion`. Output in `values.out`; this is the evidence for the `geojson` and `EPSG:4326` findings.

Run with Node 18+ (global `fetch`), from a scratch directory, e.g. `mkdir crawl && node crawl.mjs base.easscan.org`.
