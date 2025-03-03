export declare const config: {
    PORT: string;
    DATABASE_URL: string;
    NODE_ENV: "development" | "production" | "test";
    SUPABASE_URL?: string | undefined;
    SUPABASE_KEY?: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
    EAS_ENDPOINT_ARBITRUM?: string | undefined;
    EAS_ENDPOINT_CELO?: string | undefined;
    EAS_ENDPOINT_SEPOLIA?: string | undefined;
    EAS_ENDPOINT_BASE?: string | undefined;
    EAS_SCHEMA_UID?: string | undefined;
};
export declare const easEndpoints: {
    arbitrum: string | undefined;
    celo: string | undefined;
    sepolia: string | undefined;
    base: string | undefined;
};
