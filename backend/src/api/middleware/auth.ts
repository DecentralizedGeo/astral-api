import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '../../utils/logger';

/**
 * Compare two strings in constant time.
 *
 * Both values are hashed first so inputs of different lengths can be compared
 * without leaking their length through timing.
 *
 * @param a First value
 * @param b Second value
 * @returns True if the values are equal
 */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Extract the token from an `Authorization: Bearer <token>` header.
 *
 * @param header The raw Authorization header value
 * @returns The token, or null if the header is missing or not a Bearer token
 */
function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Create middleware that requires an `Authorization: Bearer <token>` header
 * matching the value of one of the given environment variables.
 *
 * Secrets are read from `process.env` on every request, so rotating a secret
 * in the deployment environment takes effect without code changes.
 *
 * The middleware fails closed: if none of the environment variables is set,
 * every request is rejected with 503 rather than allowed through.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
 * the `CRON_SECRET` environment variable is set on the project.
 *
 * @param envVarNames Names of environment variables holding accepted secrets
 * @returns Express middleware enforcing the bearer token
 */
export function requireBearerToken(...envVarNames: string[]): RequestHandler {
  if (envVarNames.length === 0) {
    throw new Error('requireBearerToken needs at least one environment variable name');
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const secrets = envVarNames
      .map(name => process.env[name])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (secrets.length === 0) {
      logger.error(
        `Rejected ${req.method} ${req.originalUrl}: none of ${envVarNames.join(', ')} is configured`
      );
      res.status(503).json({ error: 'Endpoint is not configured' });
      return;
    }

    const token = parseBearerToken(req.headers.authorization);
    if (token && secrets.some(secret => safeEqual(token, secret))) {
      next();
      return;
    }

    logger.warn(`Rejected unauthorized ${req.method} ${req.originalUrl}`);
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Unauthorized' });
  };
}
