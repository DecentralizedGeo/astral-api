"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.easEndpoints = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables
dotenv_1.default.config();
// Define a schema for environment variables
const envSchema = zod_1.z.object({
    // Database
    DATABASE_URL: zod_1.z.string(),
    // API Configuration
    PORT: zod_1.z.string().default('3000'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // Optional Supabase config
    SUPABASE_URL: zod_1.z.string().optional(),
    SUPABASE_KEY: zod_1.z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().optional(),
    // EAS Endpoints
    EAS_ENDPOINT_ARBITRUM: zod_1.z.string().optional(),
    EAS_ENDPOINT_CELO: zod_1.z.string().optional(),
    EAS_ENDPOINT_SEPOLIA: zod_1.z.string().optional(),
    EAS_ENDPOINT_BASE: zod_1.z.string().optional(),
    // EAS Schema UID
    EAS_SCHEMA_UID: zod_1.z.string().optional(),
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
exports.config = envParseResult.data;
// EAS endpoint mapping
exports.easEndpoints = {
    arbitrum: exports.config.EAS_ENDPOINT_ARBITRUM,
    celo: exports.config.EAS_ENDPOINT_CELO,
    sepolia: exports.config.EAS_ENDPOINT_SEPOLIA,
    base: exports.config.EAS_ENDPOINT_BASE,
};
//# sourceMappingURL=index.js.map