# Plan 001: Make scheduled ingestion actually run on Vercel and add auth to the sync/cron endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cf3f342..HEAD -- backend/src/api/cron/sync.ts backend/src/api/routes/index.ts backend/src/api/routes/sync.routes.ts backend/vercel.json docs/authentication.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + security
- **Planned at**: commit `cf3f342`, 2026-07-02

## Why this matters

The product's core promise is automated ingestion: `vercel.json` schedules a
cron every minute against `/api/cron/sync`. But **Vercel invokes cron paths
with an HTTP GET request**, and this repo registers the handler for POST only —
the handler itself also rejects anything that is not POST with a 405. The
scheduled job therefore never triggers a sync; ingestion only happens when a
human manually POSTs. The repo's own troubleshooting report
(`backend/reports/phase10-sync-troubleshooting-solution.md`, line 5: "The cron
job ... was not working as expected on the production deployment") is
consistent with this diagnosis.

At the same time, the state-changing sync endpoints (`POST /api/sync`,
`POST /api/sync/revocations`, `POST /api/sync/worker`) and the cron handler
have **no authentication at all**, while `docs/authentication.md` (lines 27–34)
falsely claims they are "restricted to serverless functions and cron triggers".
Anyone can trigger expensive multi-chain ingestion or stop the background
worker. This plan fixes both: cron works, and mutating endpoints require a
secret.

## Current state

Relevant files:

- `backend/vercel.json` — declares the cron (lines 55–60):

  ```json
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/1 * * * *"
    }
  ]
  ```

- `backend/src/api/routes/index.ts` — registers the cron handler for POST only
  (lines 20–30):

  ```ts
  // Register cron endpoint for Vercel
  apiRouter.post('/cron/sync', handler);

  // Also add a GET endpoint for debugging
  apiRouter.get('/cron/sync/test', (req, res) => { ... });
  ```

  There is no `GET /api/cron/sync` route, so Vercel's GET invocation gets a
  404 from Express.

- `backend/src/api/cron/sync.ts` — the handler itself rejects non-POST
  (lines 10–14):

  ```ts
  export default async function handler(req: Request, res: Response) {
    // Only allow POST requests from Vercel
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  ```

- `backend/src/api/routes/sync.routes.ts` — the unauthenticated mutating
  routes (lines 8–17):

  ```ts
  syncRouter.get('/status', SyncController.getStatus);
  syncRouter.post('/', SyncController.triggerSync);
  syncRouter.post('/revocations', SyncController.triggerRevocationCheck);
  syncRouter.post('/worker', SyncController.controlWorker);
  ```

- `docs/authentication.md` lines 27–34 claim these endpoints are restricted;
  the code contains no check.

Vercel's documented behavior: cron jobs invoke the path with a **GET** request,
and if a `CRON_SECRET` environment variable is set on the project, Vercel sends
it as `Authorization: Bearer <CRON_SECRET>` on cron invocations. Use exactly
this convention.

Repo conventions to match:

- TypeScript strict; Express handlers are `(req: Request, res: Response)` with
  try/catch and `logger` from `src/utils/logger` (see any controller, e.g.
  `backend/src/api/v0/controllers/config.controller.ts`).
- Env vars are declared in the zod schema in `backend/src/config/index.ts`
  (lines 8–30) and read via the exported `config` object. Add new env vars
  there as `z.string().optional()`, and document them in
  `backend/.env.example`.
- JSDoc on exported functions; 2-space indent; Prettier.

## Commands you will need

All commands run from `backend/`:

| Purpose | Command | Expected on success |
|-----------|------------------------------------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 |
| Dev serve | `npm run dev` | "Server running at http://localhost:PORT" in output |

To boot the dev server without real credentials, create `backend/.env` with
placeholder values (the zod schema only requires `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` to be non-empty strings):

```
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=placeholder
CRON_SECRET=test-secret
PORT=3005
```

Note: `npm test` currently fails for pre-existing reasons unrelated to this
plan (see plans/002). Do not attempt to fix the test suite here; verify via
typecheck, build, and the curl checks below.

## Scope

**In scope** (the only files you should modify):
- `backend/src/api/cron/sync.ts`
- `backend/src/api/routes/index.ts`
- `backend/src/api/routes/sync.routes.ts` (add middleware only)
- `backend/src/api/middleware/auth.ts` (create)
- `backend/src/config/index.ts` (add `CRON_SECRET` to the zod schema)
- `backend/.env.example` (document `CRON_SECRET`)
- `docs/authentication.md` (correct the "Restricted Endpoints" section)

**Out of scope** (do NOT touch, even though they look related):
- `backend/src/api/controllers/sync.controller.ts` — its error-message
  leakage and embedded mock worker are separate findings; changing worker
  logic here risks the ingestion path.
- `backend/src/workers/eas-worker.ts` and `backend/src/services/*` — no
  behavior changes to ingestion itself.
- `backend/vercel.json` routes — the cron path stays `/api/cron/sync`.
- `GET /api/sync/status` — read-only; leave it public.

## Git workflow

- Branch: `fix/001-cron-method-and-sync-auth`
- Conventional commits, matching repo style (e.g. `fix(sync): Configure
  1-minute cron job and update documentation`). Suggested:
  `fix(sync): accept Vercel cron GET with CRON_SECRET and guard mutating sync routes`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the auth middleware

Create `backend/src/api/middleware/auth.ts` exporting a
`requireCronSecret` Express middleware:

- Read the expected secret from `config.CRON_SECRET` (add
  `CRON_SECRET: z.string().optional()` to the schema in
  `backend/src/config/index.ts` first).
- Accept the request if `req.headers.authorization === 'Bearer ' + secret`.
- If `CRON_SECRET` is not configured, log a warning with `logger.warn` and
  **reject with 503** (`{ error: 'CRON_SECRET not configured' }`) — failing
  open would silently re-create the current vulnerability.
- Otherwise respond `401 { error: 'Unauthorized' }`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Register the cron route for GET and remove the POST-only guard

In `backend/src/api/routes/index.ts` replace the cron registration with:

```ts
apiRouter.get('/cron/sync', requireCronSecret, handler);
apiRouter.post('/cron/sync', requireCronSecret, handler);
```

(Keep POST working so existing manual triggers and any docs remain valid.)

In `backend/src/api/cron/sync.ts`, delete the method check (lines 11–14 in the
excerpt above) — method filtering is now done by the router, and the handler
must run for GET.

**Verify**: `npm run typecheck` → exit 0; `npm run build` → exit 0.

### Step 3: Guard the mutating sync routes

In `backend/src/api/routes/sync.routes.ts`, apply the same middleware to the
three POST routes only:

```ts
syncRouter.post('/', requireCronSecret, SyncController.triggerSync);
syncRouter.post('/revocations', requireCronSecret, SyncController.triggerRevocationCheck);
syncRouter.post('/worker', requireCronSecret, SyncController.controlWorker);
```

`GET /status` stays unguarded.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Runtime check with curl

Start the dev server (`npm run dev` with the placeholder `.env` above), then:

- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/api/cron/sync`
  → `401`
- `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer test-secret" http://localhost:3005/api/cron/sync`
  → any status **except 401, 404, or 405** (a 500 is acceptable here: the
  placeholder env has no EAS endpoints or real Supabase, so the sync itself
  fails after auth passes — auth and routing are what this step verifies)
- `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3005/api/sync`
  → `401`
- `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3005/api/sync/worker?action=stop`
  → `401`
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/api/sync/status`
  → `200` or `500` (not `401` — it must remain public)

### Step 5: Correct the documentation

In `docs/authentication.md`, rewrite the "Restricted Endpoints" section
(lines 27–34) to state: the mutating endpoints (`POST /api/sync`,
`POST /api/sync/revocations`, `POST /api/sync/worker`) and the cron endpoint
(`GET|POST /api/cron/sync`) require `Authorization: Bearer <CRON_SECRET>`;
Vercel's cron scheduler sends this automatically when the `CRON_SECRET`
project environment variable is set. Do not add new promises (API keys, JWT,
OAuth) — only make the existing section truthful.

**Verify**: `grep -n "CRON_SECRET" docs/authentication.md` → at least one match.

## Test plan

The repo's Jest baseline is currently broken (plans/002 restores it), so this
plan verifies via typecheck/build plus the curl matrix in Step 4. If plan 002
has already landed when you execute this, additionally add
`backend/src/__tests__/auth.middleware.test.ts` covering: missing header →
401, wrong secret → 401, correct secret → `next()` called, unset
`CRON_SECRET` → 503. Model the test structure on
`backend/src/__tests__/db.service.test.ts`.

## Done criteria

Machine-checkable. ALL must hold (run from `backend/`):

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "get('/cron/sync'" src/api/routes/index.ts` returns a match
- [ ] `grep -n "Method not allowed" src/api/cron/sync.ts` returns no matches
- [ ] `grep -c "requireCronSecret" src/api/routes/sync.routes.ts` returns `4` (1 import + 3 uses)
- [ ] The Step 4 curl matrix returns the expected status codes
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- You find evidence in the repo that an external scheduler other than Vercel
  cron invokes `/api/cron/sync` with POST plus its own auth header (search
  `.github/`, `docs/`, `backend/reports/` for it) — the guard scheme would
  need to match that scheduler instead.
- Adding the middleware requires modifying `sync.controller.ts` for any
  reason.
- The dev server will not boot with placeholder env values (e.g. the config
  schema now requires more variables than documented here).

## Maintenance notes

- The operator must set `CRON_SECRET` in the Vercel project settings before
  deploying this change; otherwise every cron run will get 503 (visible in
  Vercel logs). This is deliberate fail-closed behavior.
- Deferred out of this plan: the sync controllers return raw
  `error.message` to clients (information disclosure) and embed a
  `MockEasWorker` selected by `NODE_ENV` — both listed in the audit index
  (`plans/README.md`).
- If the cron schedule changes in `vercel.json`, nothing here needs to change;
  the guard is schedule-independent.
- Reviewer should scrutinize: the middleware must be mounted *before* the
  handler on the GET route, and `/api/sync/status` must remain public.
