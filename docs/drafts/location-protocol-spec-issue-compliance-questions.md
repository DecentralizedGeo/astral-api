<!--
DRAFT, NOT POSTED. Proposed issue for DecentralizedGeo/location-protocol-spec.
Prepared 2026-11-17 for the astral-api schema-agnostic redesign (astral-api#13, ADR 0001).
Post only after review. Everything below the line is the issue body.

Proposed title:
  Clarify EAS-schema conformance rules for v0.2 (lp_version type and value, canonical UID, location_type aliases, legacy schemas)
Suggested labels: documentation, question
-->

---

## Context

The Astral API is moving from indexing one hard-coded EAS schema to **discovering Location Protocol schemas on each chain and classifying them for conformance** (astral-api#13). The classifier needs a clear answer to "is this EAS schema, and this attestation, conformant to v0.2?" Where the spec answers that today, the onchain data often disagrees with it, and in a few places the spec disagrees with itself.

The evidence below comes from crawling every registered schema on 8 easscan indexers (12,151 schemas), running a candidate query on all 16 live indexers (52 candidates), and sampling all attestation values on the main schemas. The spec text is quoted from `v0.2.0-rc.1`, which is what spec.decentralizedgeo.org serves and is identical to `main`. Crawl data: `backend/tests/fixtures/eas-schemas/` in astral-api.

Each question has a **proposed answer**. These are suggestions to react to, not decisions.

Related open issues: #1 (unstructured `srs`), #8 (`stamp_type` vs `stamp_types`), #12 (URN form of CRS identifiers).

## Summary

| # | Question | Proposed answer |
|---|---|---|
| 1 | Is `lp_version` a string or a `uint8`, and what value does a v0.2 payload carry? | `string`, semver; the value is the spec release (`"0.2.0"`) |
| 2 | Which EAS schema UID is canonical for v0.2? | The minimal base `0x3902cc7b…fffd`; fix the appendix |
| 3 | Is bare `geojson` an accepted `location_type`? | Deprecated alias: accept on read, never emit |
| 4 | Should readers normalize the deprecated `EPSG:4326` short form? | Yes on read, with a warning; never emit |
| 5 | How are pre-spec ("legacy") schemas treated? | Not conformant; document a mapping in a "Prior versions" appendix |
| 6 | Does "pin trusted UIDs" forbid auto-discovery? | No. It is guidance for writers; indexers need a trust policy instead |
| 7 | How is a non-string `location` stored in an EAS `string` field? | JSON text |
| 8 | Which Solidity types and field names make an EAS schema conformant? | Four base fields, exact names, all `string` |

---

## 1. `lp_version`: string or `uint8`, and which value?

**Evidence**

- Data model: `lp_version` is a `string` and "MUST follow semantic versioning with the pattern `major.minor.patch`". The JSON Schema pattern is `^\d+\.\d+\.\d+$`.
- EAS appendix: recommends `string srs, string location_type, string location, uint8 lp_version` and encodes `{ name: "lp_version", value: 1, type: "uint8" }`.
- Every example payload in the spec uses `"lp_version": "1.0.0"`, but the spec release is 0.2.0.
- Onchain, no schema uses `uint8 lp_version`. All 26 v0.2-shaped schemas use `string lp_version`. The values disagree, though:

  | Schema | Attestations sampled | `lp_version` value |
  |---|---|---|
  | `0xde87be8a…ba81` | Sepolia 472, Base Sepolia 36 | `"1.0.0"` (all) |
  | `0x3902cc7b…fffd` | Sepolia 24 | `"1.0.0"` (all) |
  | `0x7e142d0c…111c` | Sepolia 23 | `"0.2.0"` (all) |

  So the same spec version is identified by two different values, and `"1.0.0"` claims a spec version that does not exist yet.
- Spec 0.1.0 used `specVersion` with the same string/`uint8` split. 0.1-era schemas onchain use `uint8 specVersion` with value `1`.

**Proposed answer**

- `lp_version` is a `string` everywhere, including EAS schemas. Change the appendix to `string lp_version`.
- Its value is the version of the specification the payload conforms to: `"0.2.0"` for this release. Change the examples from `"1.0.0"` to `"0.2.0"`, or explain why they use `"1.0.0"`.
- Say what readers do with `"1.0.0"` payloads already onchain (about 530 of them). Suggestion: treat `"1.0.0"` as an erratum for `"0.2.0"` and accept it with a warning until 1.0.0 ships.

**Why it matters to implementers:** a classifier has to decide whether `uint8 lp_version` is conformant, and an indexer has to record which spec version each payload follows. Right now a correct implementation of the data model rejects the appendix's own schema.

## 2. Which EAS schema UID is canonical for v0.2?

**Evidence**

- The appendix says "the `schemaUID` for the base schema string above is `0xedd6b005…0b9a`". That is incorrect. Computing `keccak256(abi.encodePacked(schema, resolver, revocable))` (zero resolver, revocable) gives:

  | Schema string | UID | Registered? |
  |---|---|---|
  | `string srs, string location_type, string location, uint8 lp_version` (the appendix string) | `0x7e642593…f55f` | **No.** Not on Sepolia, Base Sepolia, Base, Optimism or Arbitrum |
  | `string srs, string locationType, string location, uint8 specVersion` (the 0.1.0 string) | `0xedd6b005…0b9a` | Sepolia, 1 attestation |
  | `string lp_version,string srs,string location_type,string location` | `0x3902cc7b…fffd` | Sepolia (24), Base Sepolia (4) |

  The UID the appendix quotes belongs to the 0.1.0 schema.
- The de facto v0.2 schema is `0xde87be8a…ba81`:
  - `string lp_version,string srs,string location_type,string location,uint256 event_timestamp,string recipe_type,string recipe_payload,string media_type,string media_data,string memo`
  - registered on 10 chains (Ethereum, Sepolia, Base, Base Sepolia, Optimism, Optimism Sepolia, Arbitrum, Celo, Scroll, Ink) by `0x3074C873…DdB9`
  - 513 attestations, nearly all on Sepolia.

  Its optional fields are not the v0.2 composable fields: `recipe_type`, `recipe_payload` and `memo` are legacy names, and `attributes` and `proof` are missing.
- Field order is part of the UID. The appendix puts `lp_version` last; every registered v0.2 schema puts it first.

**Proposed answer**

- Make `0x3902cc7b…fffd` (`string lp_version,string srs,string location_type,string location`, zero resolver, revocable) the canonical base schema, and quote it in the appendix with its registration status per chain. It is already registered and used.
- Optionally, list `0xde87be8a…ba81` as a known deployed extended schema without calling it canonical, since its optional fields predate the composable-field list.
- State that **conformance is a property of the schema's shape, not of its UID**. A schema is conformant if its fields satisfy the rules in question 8. Listed UIDs are a convenience.
- Register the canonical base schema on the chains where it is missing, and keep the table current.

## 3. Is bare `geojson` an accepted `location_type`?

**Evidence**

- The Location Type Registry lists `geojson-point`, `geojson-line` and `geojson-polygon`. The JSON Schema enum is `["coordinate-decimal+lon-lat", "geojson-point", "geojson-line", "geojson-polygon", "h3", "geohash", "wkt", "address", "scaledCoordinates"]`. Bare `geojson` is not in either.
- The data model's own constraint on `location` says: "if `location_type` is `geojson`, this field must contain a valid GeoJSON Geometry Object".
- On `0xde87be`, **496 of 508 sampled attestations (98%) use `location_type: "geojson"`**, with a GeoJSON Point as the `location`. The other 12 use `geojson-point`.
- Legacy payloads use further variants: `GeoJSON` (286 on Base), `GeoJSON:Point`, `geojson-point`, `geojson-polygon`, `Point`, `Polygon`.

**Proposed answer**

- Keep the enum geometry-specific, and fix the data-model sentence to say `geojson-point` (or "a `geojson-*` type").
- Add a short **aliases** note: readers SHOULD accept bare `geojson` as a deprecated alias and resolve it from the geometry's `type` member (`Point` → `geojson-point`, `LineString` → `geojson-line`, `Polygon` → `geojson-polygon`). Writers MUST NOT emit it.
- Say whether matching is case-sensitive. Suggestion: identifiers are lower-case and matched exactly; `GeoJSON` is a legacy value, not an alias.
- Related: say how `MultiPoint`, `MultiPolygon` and `GeometryCollection` are expressed, or that they are out of scope for 0.2.

## 4. Should readers normalize the deprecated `EPSG:4326` short form?

**Evidence**

- The data model says `srs` "MUST be a valid HTTP URI or URN" and calls short codes deprecated. The SRS appendix includes `mapShorthandToUri` pseudocode (`EPSG:4326` → `http://www.opengis.net/def/crs/EPSG/0/4326`) and advises mapping for "Interfacing with Legacy Systems".
- Onchain, the short form dominates pre-0.2 data. Legacy schema `0xba4171`: `EPSG:4326` on 325 of 340 Sepolia and 383 of 423 decodable Base attestations, plus `EPSG:3857` (15) and `gps` (40). All 0.1 attestations sampled use `EPSG:4326`.
- v0.2 data uses both full forms: `urn:ogc:def:crs:EPSG::4326` (all of `0xde87be`) and `http://www.opengis.net/def/crs/OGC/1.3/CRS84`. See #12.
- **Axis order:** every `0xde87be` attestation declares `urn:ogc:def:crs:EPSG::4326`, whose axis order is latitude, longitude, but carries a GeoJSON Point with `[longitude, latitude]` (e.g. `[-121.49, 38.59]`, Sacramento). RFC 7946 fixes GeoJSON to CRS84 lon/lat.

**Proposed answer**

- Readers SHOULD map the known short forms (`EPSG:4326`, `EPSG:3857`, `CRS:84`) to their canonical URI or URN on read, and record that the payload used a deprecated form. Writers MUST NOT emit short forms. Unrecognized values (`gps`) are invalid.
- For `geojson-*` location types, state that coordinates are always lon/lat per RFC 7946, and that `srs` SHOULD be CRS84 (URI or URN). Say what a reader does when a GeoJSON payload declares EPSG:4326: suggestion, read lon/lat and warn.
- Fold the URN examples from #12 into the same change.

## 5. How should pre-spec ("legacy") schemas be treated?

**Evidence**

- Astral's original schema `0xba4171c9…24e2` predates the spec. It has no version field and camelCase names:
  - `uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo`
  - It holds most of the location attestations onchain: 952 across Base, Sepolia, Base Sepolia, Arbitrum, Optimism and Celo.
  - Its `locationType` values (`DecimalDegrees<string>`, `GeoJSON`, `coordinate-decimal+lat-lon`, …) are not in the v0.2 registry.
- The spec does not mention it. Spec 0.1.0 (`specVersion`, camelCase) is a second generation with 6 schemas and about 22 attestations, all on Sepolia.
- Without guidance, each indexer invents its own mapping. The current Astral API silently fills defaults such as `srs = 'WGS84'` for missing values.

**Proposed answer**

- Add a short "Prior versions" appendix that:
  - names the two earlier generations (pre-spec Astral and 0.1.0) and their field names
  - gives the field mapping to 0.2: `specVersion` → `lp_version`, `locationType` → `location_type`, `eventTimestamp` → `event_timestamp`, `mediaType`/`mediaData` → `media_type`/`media_data`
  - says legacy schemas are **not** 0.2-conformant, and that indexers MAY ingest them as long as they label each record with the generation it came from rather than presenting it as 0.2, and never invent missing values.
- Optionally, define a reserved `lp_version` value for "pre-spec" (e.g. `"0.0.0"`) so mapped records have a version.

## 6. Does "pin trusted UIDs" conflict with auto-discovery?

**Evidence**

- EAS appendix, Security Best Practices: "Always use a specific, trusted `schemaUID` in your application. Do not dynamically generate it from a schema string, as this could expose your application to a malicious schema registered with the same string but different properties (e.g., a different resolver)."
- An indexer that discovers conformant schemas by shape is doing something different from deriving a UID from a string. The stated risk (same string, different resolver) is already visible: the resolver and `revocable` flag are inputs to the UID and are returned by the indexer. The real risk for discovery is that **anyone can register a shape-conformant schema and write arbitrary records into an index**. On Sepolia there are already six zero-attestation `string lp_version,string srs,string location_type,string location,string test_<timestamp>` schemas.

**Proposed answer**

- Clarify that the pinning advice addresses **writers and verifiers** that choose which schema to attest with or trust.
- Add guidance for **indexers and aggregators**: they MAY discover schemas by shape, but SHOULD apply an explicit trust policy (an allowlist of creators or UIDs, or manual approval) before treating records as authoritative. They SHOULD also expose the schema UID, creator and resolver with every record, so consumers can apply their own policy.

## 7. How is a non-string `location` stored in an EAS `string` field?

**Evidence**

- The data model types `location` as `string | number[] | object`. The location-types page gives `coordinate-decimal+lon-lat` as `[-103.771556, 44.967243]` (a JSON array) and GeoJSON as an object.
- EAS schemas declare `string location`. The appendix's own encoding example writes `coordinate-decimal+lon-lat` as `"-103.771556, 44.967243"`, a comma-separated string that is neither the JSON array nor its JSON text.
- Onchain, v0.2 payloads store GeoJSON as JSON text (`"{\"type\":\"Point\",\"coordinates\":[...]}"`). The 0.1 payloads store `"37.785834,-122.406417"`, a comma string in lat,lon order.

**Proposed answer**

- In EAS (and any string-typed binding), a non-string `location` is serialized as RFC 8259 JSON text, and readers parse it back before validating against `location_type`. Fix the appendix example to `"[-103.771556,44.967243]"`.

## 8. Which Solidity types and field names make an EAS schema conformant?

**Evidence**

- The spec never states which Solidity types the base fields may use in an EAS schema. Questions 1 and 7 cover `lp_version` and `location`. Onchain there are schemas that are otherwise conformant but declare:
  - `bytes location` (`0xd928da08`, 22 attestations)
  - `uint40[] location` (`0x5894dbce`, 24 attestations, all `scaledCoordinates`) and `int40[] location` (`0xe26f07e6`, 1)
  - `string[] location` (`0xe5ea0fa9`, 45 attestations)
  - `unit8 specVersion` (a typo)
- Names: several v0.2-shaped schemas use exact snake_case base fields with camelCase optional fields (e.g. `0x7e142d0c`: `uint256 eventTimestamp,string[] recipeType,…`). It is unclear whether an optional field is recognized under a non-spec name.

**Proposed answer**

- An EAS schema is v0.2-conformant if it contains `string lp_version`, `string srs`, `string location_type` and `string location`:
  - names matched exactly (case-sensitive)
  - no duplicates
  - in any order
  - with any number of additional fields.
- Composable fields are recognized only under their spec names and types (`uint256 event_timestamp`, `string media_type`, …). Fields under other names are carried as unrecognized extras, which is allowed.
- A schema with all four base fields under the right names but a different type (e.g. `bytes location`) is not conformant. Implementations may report it as "near-conformant" to help authors fix it.

---

### What astral-api will do in the meantime

Until these are settled, the API will treat the proposed answers above as **provisional**. It will:
- store a validation status and the raw decoded payload for every attestation, so records can be reclassified later without re-ingesting
- avoid hard-coding any rule that depends on questions 1–4 outside the shared compliance module (astral-api ADR 0001).
