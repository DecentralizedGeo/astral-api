# Plan 003: Remove the hardcoded RPC provider credential from `eas.service.ts` and rotate it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **SECURITY HANDLING**: This plan concerns a committed credential. Never
> copy the credential value into any commit message, log output, test, PR
> description, or report. Refer to it only as "the Infura project ID at
> `eas.service.ts:43-58`".
>
> **Drift check (run first)**: `git diff --stat cf3f342..HEAD -- backend/src/services/eas.service.ts backend/src/config/index.ts backend/.env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `cf3f342`, 2026-07-02

## Why this matters

`backend/src/services/eas.service.ts` hardcodes four blockchain RPC URLs, each
embedding the same **Infura project ID (an API credential)**, at lines 43, 48,
53 and 58, inside the `CHAIN_CONFIG` constant. The repository is public and
the credential has been in git history since commit `ad6bc9b`. Anyone can use
it, exhaust its quota (denying service to the project), or run up usage
attributed to the project's account. Because it is in history, deleting it
from the code is not enough — **the credential must be rotated** at the
provider.

The good news, confirmed by reading every use site: the objects built from
these URLs are never actually used for RPC calls, so the whole block can be
removed rather than parameterized.

## Current state

- `backend/src/services/eas.service.ts:41-62` — `CHAIN_CONFIG` maps each of
  `arbitrum`/`celo`/`sepolia`/`base` to `{ rpcUrl, contractAddress, schemaUID }`,
  where every `rpcUrl` is an Infura HTTPS URL ending in the same project ID.
  (Excerpt deliberately omitted — do not reproduce the values.)

- `eas.service.ts:112-121` (constructor) builds, per chain:

  ```ts
  const provider = new JsonRpcProvider(chainConfig.rpcUrl);
  this.providers[chain] = provider;

  const eas = new EAS(chainConfig.contractAddress);
  // Use as unknown to bypass TypeScript checking since EAS.connect exists but TypeScript doesn't see it
  (eas as unknown as { connect: (provider: JsonRpcProvider) => void }).connect(provider);
  this.easClients[chain] = eas;
  ```

- **Usage audit (verified at `cf3f342`)**: `this.providers` is written at
  line 116 and never read anywhere. `this.easClients` is read at exactly two
  places, both mere existence checks that gate on whether the chain is known:

  ```ts
  // eas.service.ts:206 (fetchAttestations) and :697 (checkRevocationStatus)
  if (!this.easClients[chain]) {
    throw new Error(`Chain ${chain} is not supported`);
  }
  ```

  All real network traffic goes through `this.graphqlClients` (Apollo clients
  for the EAS indexer GraphQL endpoints from `EAS_ENDPOINT_*` env vars —
  constructor lines 123-141). No `eth_call`/on-chain RPC is ever issued.

- `CHAIN_CONFIG` is also read for its `schemaUID` field at
  `eas.service.ts:233` (`this.chainConfigs[chain ...].schemaUID`) and `:582` —
  `schemaUID` is the module-level constant from config/env (lines 37-38), the
  same for every chain.

- The imports at `eas.service.ts:3-4`:

  ```ts
  import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
  import { JsonRpcProvider } from 'ethers';
  ```

  `SchemaEncoder` is still used (line 108, `this.schemaEncoder`) — keep it.

Repo conventions: env vars go through the zod schema in
`backend/src/config/index.ts` and `backend/.env.example`; strict TypeScript;
JSDoc on methods.

## Commands you will need

All from `backend/`:

| Purpose | Command | Expected on success |
|-----------|---------------------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | exit 0 **only if plan 002 has landed**; otherwise 2 pre-existing failures — compare against the baseline, add no new failures |

## Scope

**In scope** (the only files you should modify):
- `backend/src/services/eas.service.ts`
- `backend/src/services/__tests__/eas.service.test.ts` (only if it references
  removed members)

**Out of scope** (do NOT touch):
- `backend/package.json` — do NOT remove the `ethers` /
  `@ethereum-attestation-service/eas-sdk` dependencies even though this change
  reduces their usage; `SchemaEncoder` still imports from the SDK, and
  dependency pruning is a separate index item.
- `backend/src/config/index.ts` and `.env.example` — no new env var is needed
  because the RPC construction is removed, not parameterized. (If you hit the
  STOP condition below, that changes.)
- Rotation itself — an operator action at the provider dashboard; you cannot
  do it from this repo (see Step 4).

## Git workflow

- Branch: `fix/003-remove-hardcoded-rpc-credential`
- Conventional commit, e.g.
  `fix(eas): remove unused RPC provider construction and embedded credential`.
  Do not paste the credential or its prefix into the message.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the chain-support checks

In `eas.service.ts`, change both existence checks (lines 206 and 697) from
`this.easClients[chain]` to `this.chainConfigs[chain as keyof typeof CHAIN_CONFIG]`:

```ts
if (!this.chainConfigs[chain as keyof typeof CHAIN_CONFIG]) {
  throw new Error(`Chain ${chain} is not supported`);
}
```

**Verify**: `grep -n "easClients\[chain\]" src/services/eas.service.ts` → no
matches.

### Step 2: Delete the provider/EAS-client construction and the credential

In `eas.service.ts`:

1. In `CHAIN_CONFIG` (lines 41-62), delete the `rpcUrl` and `contractAddress`
   fields, leaving each chain as `{ schemaUID }`. (Keeping the per-chain keys
   preserves the "is this chain supported" semantics and the `schemaUID`
   lookups at lines 233/582.)
2. In the constructor, delete the `provider`/`eas` construction block
   (the excerpt shown in "Current state") and the
   `this.providers = {}; this.easClients = {};` initializations, the
   `private providers` / `private easClients` field declarations (lines
   69-70), and the now-unused imports `EAS` (keep `SchemaEncoder`) and
   `JsonRpcProvider`.
3. Keep the `logger.info(\`Initialized EAS client for ${chain}\`)` semantics
   by adjusting the message to reflect GraphQL-client initialization, or
   remove it — your choice; no caller parses it.

**Verify**:
- `grep -in "infura" src/services/eas.service.ts` → no matches
- `grep -rn "JsonRpcProvider\|easClients\|this.providers" src/services/eas.service.ts` → no matches
- `npm run typecheck` → exit 0

### Step 3: Repo-wide sweep for the credential

**Verify**: `grep -rin "infura" backend/src/ docs/ *.md` (from repo root:
`grep -rin infura --include='*.ts' --include='*.md' . | grep -v node_modules`)
→ no matches in tracked source/docs. (Git history will still contain it —
that is what rotation is for.)

### Step 4: Record the rotation requirement

You cannot rotate the credential from this repository. In your completion
report (and the `plans/README.md` status note), state:

> The Infura project ID formerly at `eas.service.ts:43-58` must be rotated at
> the provider dashboard — it remains exposed in git history (since commit
> `ad6bc9b`) even after this change. No code change depends on the new
> credential because RPC construction was removed entirely.

Do not include the credential value.

## Test plan

- If plan 002 has landed: run `npm test`; the eas.service suite must still
  pass (it exercises `processChain`/`fetchAttestations`, which do not touch
  the removed members). Add one test asserting `processChain('boguschain')`
  rejects with `Chain boguschain is not supported`, modeled on the existing
  error-case tests in `eas.service.test.ts`.
- If plan 002 has not landed: verification is typecheck + build + the greps
  above; note the pre-existing 2 failed suites in your report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rin infura backend/src` → no matches
- [ ] `grep -n "rpcUrl" backend/src/services/eas.service.ts` → no matches
- [ ] `cd backend && npm run typecheck` exits 0
- [ ] `cd backend && npm run build` exits 0
- [ ] Unsupported-chain error behavior preserved: `grep -n "is not supported" backend/src/services/eas.service.ts` → 2 matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] Completion report includes the rotation notice (without the value)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You find ANY real read of `this.providers` or a method call on
  `this.easClients[...]` beyond the two existence checks (e.g. code added
  since `cf3f342` that performs on-chain reads). In that case removal is
  wrong — the fix becomes moving the URL to env config (new
  `EAS_RPC_URL_*` zod vars) — report before doing that.
- Deleting `contractAddress` breaks a reference somewhere
  (`grep -rn "contractAddress" backend/src` should only match
  `eas.service.ts` before your edit).
- Typecheck failures appear in files outside the in-scope list.

## Maintenance notes

- **Operator action required**: rotate the Infura project ID. Consider also
  purging it from git history (e.g. via GitHub support / history rewrite) —
  but rotation makes that optional.
- If on-chain verification is ever added back (e.g. verifying attestations
  directly via the EAS contract rather than the indexer), RPC URLs must come
  from environment configuration, never source, and the eas-sdk `EAS` client
  construction can be restored around them.
- Reviewer should scrutinize: no behavioral change to `fetchAttestations` /
  `checkRevocationStatus` beyond the support-check source; the diff should be
  purely deletions plus the two check rewrites.
- Follow-up (index item): with `EAS`/`JsonRpcProvider` gone, `ethers` remains
  only as a transitive/SchemaEncoder dependency — candidates for the
  dependency-pruning task.
