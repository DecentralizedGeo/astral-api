/**
 * Tests for endpoint authentication: the bearer-token middleware, the Vercel
 * cron route, and the mutating sync routes.
 */

import express, { Router } from 'express';
import request from 'supertest';

import { requireBearerToken } from '../../src/api/middleware/auth';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

// Replace route handlers with stubs so only routing and auth are exercised
const okHandler = (name: string) =>
  jest.fn((req: express.Request, res: express.Response) => {
    res.status(200).json({ handler: name });
  });

const mockCronHandler = okHandler('cron');
jest.mock('../../src/api/cron/sync', () => ({
  __esModule: true,
  default: (req: express.Request, res: express.Response) => mockCronHandler(req, res),
}));

const mockSyncController = {
  getStatus: okHandler('status'),
  triggerSync: okHandler('triggerSync'),
  triggerRevocationCheck: okHandler('revocations'),
  controlWorker: okHandler('worker'),
};
jest.mock('../../src/api/controllers/sync.controller', () => ({
  SyncController: {
    getStatus: (req: express.Request, res: express.Response) => mockSyncController.getStatus(req, res),
    triggerSync: (req: express.Request, res: express.Response) => mockSyncController.triggerSync(req, res),
    triggerRevocationCheck: (req: express.Request, res: express.Response) =>
      mockSyncController.triggerRevocationCheck(req, res),
    controlWorker: (req: express.Request, res: express.Response) => mockSyncController.controlWorker(req, res),
  },
}));

jest.mock('../../src/api/v0/routes', () => ({ v0Router: jest.requireActual('express').Router() }));
jest.mock('../../src/api/ogc/routes', () => ({ ogcRouter: jest.requireActual('express').Router() }));

const CRON_SECRET = 'cron-secret-0123456789abcdef';
const ADMIN_TOKEN = 'admin-token-0123456789abcdef';

/**
 * Build an app from a fresh copy of the API router, so module-load-time
 * settings such as DISABLE_SYNC_TRIGGER are re-read.
 */
function buildApp(): express.Express {
  let apiRouter: Router | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    apiRouter = require('../../src/api/routes').apiRouter;
  });
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter as Router);
  return app;
}

const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.SYNC_ADMIN_TOKEN = ADMIN_TOKEN;
  delete process.env.DISABLE_SYNC_TRIGGER;
});

afterAll(() => {
  process.env = savedEnv;
});

describe('requireBearerToken', () => {
  function appWith(...envVarNames: string[]): express.Express {
    const app = express();
    app.get('/protected', requireBearerToken(...envVarNames), (req, res) => {
      res.status(200).json({ ok: true });
    });
    return app;
  }

  it('allows a request with the matching bearer token', async () => {
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', `Bearer ${CRON_SECRET}`)
      .expect(200, { ok: true });
  });

  it('accepts the scheme case-insensitively', async () => {
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', `bearer ${CRON_SECRET}`)
      .expect(200);
  });

  it('rejects a missing Authorization header with 401', async () => {
    const res = await request(appWith('CRON_SECRET')).get('/protected').expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('rejects a wrong token with 401', async () => {
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', 'Bearer wrong-token-0123456789')
      .expect(401);
  });

  it('rejects a non-Bearer scheme with 401', async () => {
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', `Basic ${CRON_SECRET}`)
      .expect(401);
  });

  it('accepts any of several configured secrets', async () => {
    const app = appWith('CRON_SECRET', 'SYNC_ADMIN_TOKEN');
    await request(app).get('/protected').set('Authorization', `Bearer ${CRON_SECRET}`).expect(200);
    await request(app).get('/protected').set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
  });

  it('fails closed with 503 when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', 'Bearer anything-at-all-here')
      .expect(503);
  });

  it('treats an empty secret as not configured', async () => {
    process.env.CRON_SECRET = '';
    await request(appWith('CRON_SECRET'))
      .get('/protected')
      .set('Authorization', 'Bearer ')
      .expect(503);
  });

  it('throws when created without any environment variable names', () => {
    expect(() => requireBearerToken()).toThrow();
  });
});

describe('cron route /api/cron/sync', () => {
  it('runs on GET with CRON_SECRET, as Vercel Cron sends it', async () => {
    await request(buildApp())
      .get('/api/cron/sync')
      .set('Authorization', `Bearer ${CRON_SECRET}`)
      .expect(200, { handler: 'cron' });
    expect(mockCronHandler).toHaveBeenCalledTimes(1);
  });

  it('runs on POST with CRON_SECRET for manual triggers', async () => {
    await request(buildApp())
      .post('/api/cron/sync')
      .set('Authorization', `Bearer ${CRON_SECRET}`)
      .expect(200);
  });

  it('accepts SYNC_ADMIN_TOKEN for manual triggers', async () => {
    await request(buildApp())
      .get('/api/cron/sync')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
  });

  it('rejects unauthenticated requests without running the sync', async () => {
    const app = buildApp();
    await request(app).get('/api/cron/sync').expect(401);
    await request(app).post('/api/cron/sync').expect(401);
    expect(mockCronHandler).not.toHaveBeenCalled();
  });

  it('keeps the registration check endpoint public', async () => {
    await request(buildApp()).get('/api/cron/sync/test').expect(200);
  });
});

describe('sync routes /api/sync', () => {
  const mutatingRoutes = ['/api/sync', '/api/sync/revocations', '/api/sync/worker'];

  it.each(mutatingRoutes)('POST %s requires SYNC_ADMIN_TOKEN', async route => {
    const app = buildApp();
    await request(app).post(route).expect(401);
    await request(app).post(route).set('Authorization', `Bearer ${CRON_SECRET}`).expect(401);
    await request(app).post(route).set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(200);
  });

  it('fails closed when SYNC_ADMIN_TOKEN is not configured', async () => {
    delete process.env.SYNC_ADMIN_TOKEN;
    await request(buildApp()).post('/api/sync/worker').set('Authorization', 'Bearer x').expect(503);
    expect(mockSyncController.controlWorker).not.toHaveBeenCalled();
  });

  it('keeps GET /api/sync/status public', async () => {
    await request(buildApp()).get('/api/sync/status').expect(200, { handler: 'status' });
  });

  it('removes the trigger endpoint when DISABLE_SYNC_TRIGGER=true', async () => {
    process.env.DISABLE_SYNC_TRIGGER = 'true';
    await request(buildApp())
      .post('/api/sync')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(404);
    expect(mockSyncController.triggerSync).not.toHaveBeenCalled();
  });

  it('keeps the trigger endpoint when DISABLE_SYNC_TRIGGER=false', async () => {
    process.env.DISABLE_SYNC_TRIGGER = 'false';
    await request(buildApp())
      .post('/api/sync')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
  });
});
