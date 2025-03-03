import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define a schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string(),
  
  // API Configuration
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional Supabase config
  SUPABASE_URL: z.string().optional(),
  SUPABASE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // EAS Endpoints
  EAS_ENDPOINT_ARBITRUM: z.string().optional(),
  EAS_ENDPOINT_CELO: z.string().optional(),
  EAS_ENDPOINT_SEPOLIA: z.string().optional(),
  EAS_ENDPOINT_BASE: z.string().optional(),
  
  // EAS Schema UID
  EAS_SCHEMA_UID: z.string().optional(),
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