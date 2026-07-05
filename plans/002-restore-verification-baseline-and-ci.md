# Plan 002: Restore a green `npm test` baseline and add a CI gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cf3f342..HEAD -- backend/src/services/__tests__/eas.service.test.ts backend/src/tests/ backend/jest.config.js backend/package.json .github/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests + dx
- **Planned at**: commit `cf3f342`, 2026-07-02

## Why this matters

There is currently no single command that tells anyone whether this codebase
works. `npm test` fails: 2 of 4 suites are broken. One suite tests a method
(`ingestAttestations`) that does not exist on the service — dead coverage that
looks like protection but isn't. There is **no CI at all** (no `.github/`
directory), even though the project's PRD (`.ai/PRD.md`) requires "CI/CD,
automated testing ... from the start", and Vercel deploys `main` on push with
no test gate. Separately, the GraphQL schema imports `graphql-tag`, which is
not declared in `package.json` — it resolves only as a transitive dependency
and can break on any dedupe. Every other risky improvement to this repo
(revocation re-enable, DB-layer consolidation, bbox rework) needs this
baseline first.

## Current state

Measured at commit `cf3f342` (after full `npm ci`):

- `npm test`: `Test Suites: 2 failed, 2 passed, 4 total; Tests: 4 passed`.
- `npm run typecheck`: exits 0 on a complete install.
- `npm run lint`: 71 errors, 142 warnings (do NOT try to fix these here; see
  Scope).

The four test suites:

- `backend/src/services/__tests__/eas.service.test.ts` — FAILS to compile.
  It calls a method that does not exist. Excerpt (lines 212–224):

  ```ts
  jest.spyOn(easService, 'fetchAttestations').mockResolvedValue(mockAttestations);

  // Call ingestAttestations
  const result = await easService.ingestAttestations('arbitrum');

  // Verify fetchAttestations was called
  expect(easService.fetchAttestations).toHaveBeenCalledWith('arbitrum');

  // Verify createLocationProof was called
  expect(mockDbService.createLocationProof).toHaveBeenCalledWith(mockAttestations[0]);

  // Verify result
  expect(result).toBe(1);
  ```

  The real service (`backend/src/services/eas.service.ts`) has
  `fetchAttestations(chain, limit, fromTimestamp)` (line 205),
  `processChain(chain): Promise<number>` (line 579), and
  `processAllChains(): Promise<Record<string, number>>` (line 665) — but no
  `ingestAttestations`. `processChain` is the method that does what these
  tests describe (fetch → exists-check → `createLocationProof` → count).
  Also note line 212 mocks `fetchAttestations` to resolve `mockAttestations`
  built as `LocationProof[]` — the mock data must instead be shaped as the
  service's `EASAttestation` interface (`eas.service.ts:11-19`: `id`,
  `attester`, `recipient`, `revocationTime`, `timeCreated`, `data`,
  `decodedDataJson`).
  A later block (lines 242–262) mocks `ingestAttestations` to test
  `processAllChains` — same rename applies. Note `processAllChains` iterates
  `Object.keys(this.graphqlClients)` (`eas.service.ts:668`), not `clients` —
  the test's `(easService as any).clients = {...}` (line 245) must set
  `graphqlClients` instead.

- `backend/src/tests/supabase-spatial.test.ts` — an integration test needing
  live Supabase credentials; in this environment it crashes the Jest worker.
  Excerpt (lines 21–27):

  ```ts
  test('should query location proofs within a bounding box', async () => {
    // Skip if Supabase is not available
    if (!supabaseService.isAvailable()) {
      console.warn('Supabase client not available. Skipping test.');
      return;
    }
  ```

  Importing `supabase.service` transitively imports `src/config`, which calls
  `process.exit(1)` when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset
  (`backend/src/config/index.ts:37-41`) — that `process.exit` is what kills
  the Jest child process. This suite must not run in the default unit pass.

- `backend/src/__tests__/db.service.test.ts` and
  `backend/src/__tests__/setup.test.ts` — pass (4 assertions total).

- `backend/jest.config.js` (complete current content):

  ```js
  module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    transform: { '^.+\\.tsx?$': 'ts-jest' },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  };
  ```

- `backend/src/graphql/schema.ts:1` — `import { gql } from 'graphql-tag';`
  while `backend/package.json` `dependencies` (lines 27–41) do not declare
  `graphql-tag`.

Repo conventions: TypeScript strict, Jest + ts-jest, tests colocated in
`__tests__` directories, `describe`/`it` style — model new/edited tests on
`backend/src/__tests__/db.service.test.ts`.

## Commands you will need

All from `backend/` unless noted:

| Purpose | Command | Expected on success |
|-----------|---------------------|---------------------|
| Install | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0, 0 failed suites |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | (currently 71 errors — not a gate here) |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `backend/src/services/__tests__/eas.service.test.ts`
- `backend/jest.config.js`
- `backend/package.json` + `backend/package-lock.json` (add `graphql-tag`,
  add an `test:integration` script)
- `.github/workflows/ci.yml` (create, at repo root)

**Out of scope** (do NOT touch):
- `backend/src/services/eas.service.ts` — do NOT add an `ingestAttestations`
  method to make the old tests pass; the tests adapt to the code, not the
  reverse.
- `backend/src/tests/supabase-spatial.test.ts` — leave its content as is;
  it is excluded via config, not rewritten.
- The 71 lint errors — a separate ratchet task (see `plans/README.md`);
  CI runs lint as non-blocking.
- All production source under `backend/src/` other than nothing — this plan
  changes tests and config only.

## Git workflow

- Branch: `fix/002-test-baseline-and-ci`
- Conventional commits, e.g.
  `test(eas): align ingestion tests with processChain API` and
  `ci: add typecheck/build/test workflow`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Exclude the integration suite from the default run

In `backend/jest.config.js` add:

```js
testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/tests/'],
```

and set `collectCoverage: false` (coverage stays available via
`npx jest --coverage`; always-on coverage makes the suite slow and noisy for
a gate). Add to `backend/package.json` scripts:

```json
"test:integration": "jest --testPathIgnorePatterns=/node_modules/ --testMatch '**/src/tests/**/*.test.ts'"
```

**Verify**: `npx jest --listTests` → lists the three suites under
`src/__tests__/` and `src/services/__tests__/`, does NOT list
`src/tests/supabase-spatial.test.ts`.

### Step 2: Fix the eas.service suite against the real API

In `backend/src/services/__tests__/eas.service.test.ts`:

1. Replace every call to `easService.ingestAttestations('arbitrum')` with
   `easService.processChain('arbitrum')`.
2. Reshape the mocked fetch results as `EASAttestation` objects
   (`id`, `attester`, `recipient`, `revocationTime: "0"`,
   `timeCreated: "1700000000"`, `data: '0x'`, and a `decodedDataJson` string
   — build it with `JSON.stringify([...])` matching the `DecodedDataItem`
   shape `{name, type, value: {value}}` used by
   `convertAttestationToLocationProof` (`eas.service.ts:317-345`)).
   Include at least `eventTimestamp`, `srs`, `locationType`, `location`.
3. The exists-check: `processChain` calls `dbService.locationProofExists(id)`
   (`eas.service.ts:610`) before inserting — mock it to resolve `false` for
   the "ingests new attestation" case and `true` for a new "skips existing"
   case, asserting `createLocationProof` is/isn't called accordingly.
4. In the `processAllChains` block, replace
   `(easService as any).clients = {...}` with
   `(easService as any).graphqlClients = {...}` and mock
   `jest.spyOn(easService, 'processChain')` instead of `ingestAttestations`.
5. Keep the existing passing describe blocks untouched.

**Verify**: `npx jest src/services/__tests__/eas.service.test.ts` → suite
passes, 0 failures.

### Step 3: Declare graphql-tag

From `backend/`: `npm install graphql-tag@^2.12.6 --save`
(2.12.x is what Apollo already pulls transitively; check with
`npm ls graphql-tag` and match the major.minor if different).

**Verify**: `grep '"graphql-tag"' package.json` → one match in
`dependencies`; `npm run typecheck` → exit 0.

### Step 4: Full local gate

**Verify**: `npm test` → exit 0, `Test Suites: 3 passed, 3 total` (or more
if suites were added since); `npm run build` → exit 0.

### Step 5: Add the CI workflow

Create `.github/workflows/ci.yml` (repo root):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: npm run lint
        continue-on-error: true # 71 pre-existing errors; ratchet separately
```

**Verify**: `npx --yes yaml-lint .github/workflows/ci.yml` exits 0, or
alternatively `node -e "require('js-yaml')"` is unavailable — then verify by
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
→ exit 0.

## Test plan

This plan *is* the test plan for the repo. New/changed tests:

- `eas.service.test.ts`: happy-path ingest via `processChain` (new attestation
  → `createLocationProof` called, returns 1), skip-existing case (exists →
  not called, returns 0), empty-fetch case (returns 0), `processAllChains`
  aggregation and per-chain error isolation (existing cases, renamed target).
- Pattern to follow: `backend/src/__tests__/db.service.test.ts` (jest.mock of
  `pg`, singleton service import).
- Verification: `npm test` → all suites pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0 with 0 failed suites
- [ ] `grep -rn "ingestAttestations" backend/src/` returns no matches
- [ ] `npx jest --listTests` (in `backend/`) does not list `supabase-spatial`
- [ ] `grep '"graphql-tag"' backend/package.json` → 1 match in dependencies
- [ ] `.github/workflows/ci.yml` exists and parses as YAML
- [ ] `cd backend && npm run typecheck && npm run build` exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `eas.service.ts` has gained an `ingestAttestations` method since this plan
  was written (the tests may then be partially valid — re-assess).
- Making the eas.service suite pass appears to require changing
  `eas.service.ts` itself.
- `npm ci` cannot produce a complete install in your environment (missing
  modules like `ethers`/`axios` after install) — the baseline numbers in
  "Current state" assume a full install.
- The `processChain` control flow no longer matches the description in Step 2
  (fetch → exists-check → create → count).

## Maintenance notes

- Once the lint ratchet lands (see index), remove `continue-on-error` from the
  lint step so CI enforces it.
- Plans 003–005 assume this CI gate exists; they add tests that run in it.
- The integration suite (`src/tests/`) now needs an explicit
  `npm run test:integration` with real credentials — document this in
  `backend/README.md` when someone next touches docs (deliberately out of
  scope here).
- Reviewer should scrutinize: that no `src/` production file changed, and
  that the reshaped `decodedDataJson` fixtures genuinely exercise
  `convertAttestationToLocationProof` rather than bypassing it.
