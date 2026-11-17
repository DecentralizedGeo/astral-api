import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// An optional secret of at least 16 characters; an empty string counts as unset
const optionalSecret = z.preprocess(
  value => (value === '' ? undefined : value),
  z.string().min(16, 'must be at least 16 characters').optional()
);

// Define a schema for environment variables
const envSchema = z.object({
  // Database (making it optional since we're using Supabase exclusively)
  DATABASE_URL: z.string().optional(),
  
  // API Configuration
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Required Supabase config (since we're using Supabase exclusively)
  SUPABASE_URL: z.string(),
  SUPABASE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // EAS Endpoints
  EAS_ENDPOINT_ARBITRUM: z.string().optional(),
  EAS_ENDPOINT_CELO: z.string().optional(),
  EAS_ENDPOINT_SEPOLIA: z.string().optional(),
  EAS_ENDPOINT_BASE: z.string().optional(),
  
  // EAS Schema UID
  EAS_SCHEMA_UID: z.string().optional(),
  EAS_SCHEMA_RAW_STRING: z.string().optional(),

  // Endpoint auth (read per request by api/middleware/auth.ts; validated here).
  // Routes guarded by a secret that is not set reject every request (503).
  // CRON_SECRET: sent by Vercel Cron as `Authorization: Bearer <value>`.
  // Empty values (e.g. `CRON_SECRET=` copied from .env.example) count as unset.
  CRON_SECRET: optionalSecret,
  // SYNC_ADMIN_TOKEN: required for POST /api/sync, /api/sync/revocations, /api/sync/worker.
  SYNC_ADMIN_TOKEN: optionalSecret,
});

// Process.env is an object with string keys and possibly undefined values
// Here we attempt to validate and parse environment variables
const envParseResult = envSchema.safeParse(process.env);

// Check if validation was successful
if (!envParseResult.success) {
  console.error('Invalid environment variables:');
  console.error(envParseResult.error.format());
  process.exit(1);
}

// Extract validated env variables
export const config = envParseResult.data;

// EAS endpoint mapping
export const easEndpoints = {
  arbitrum: config.EAS_ENDPOINT_ARBITRUM,
  celo: config.EAS_ENDPOINT_CELO,
  sepolia: config.EAS_ENDPOINT_SEPOLIA,
  base: config.EAS_ENDPOINT_BASE,
};