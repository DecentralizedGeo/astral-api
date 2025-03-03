# Astral API Backend

## Setup

> **Deployment Instructions**: For deploying to Vercel, see [VERCEL-DEPLOY.md](VERCEL-DEPLOY.md) and [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) for detailed steps.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

### 3. Set up Supabase database

Follow the instructions in the main SUPABASE-SETUP.md file in the root directory to set up the database schema and spatial query functions. The setup includes:

- Creating the location_proofs table with PostGIS geometry column
- Creating spatial indexes
- Setting up Row Level Security policies
- Creating spatial query functions for:
  - Bounding box queries (location_proofs_in_bbox)
  - Radius-based queries (location_proofs_within)

### 4. Start the server

```bash
npm run build
npm start
```

For development mode:

```bash
npm run dev
```

## API Usage

### Querying location proofs with spatial filtering

You can query location proofs within a bounding box using the `bbox` parameter:

```typescript
// Example: Query location proofs in San Francisco area
const params = {
  bbox: [-122.5, 37.7, -122.3, 37.9] // [minLon, minLat, maxLon, maxLat]
};

const proofs = await supabaseService.queryLocationProofs(params);
```

### Additional query parameters

- `chain`: Filter by blockchain network
- `prover`: Filter by the address that created the proof
- `subject`: Filter by the subject address
- `fromTimestamp`: Filter proofs after this timestamp
- `toTimestamp`: Filter proofs before this timestamp
- `limit`: Maximum number of results to return
- `offset`: Pagination offset

## Deployment

### Deployment to Vercel

Follow these steps to deploy the Astral API to Vercel:

1. Follow the detailed instructions in [VERCEL-DEPLOY.md](VERCEL-DEPLOY.md)
2. Use the [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) to ensure you've completed all necessary steps
3. Set up all required environment variables in the Vercel dashboard
4. Enable the cron job for automatic attestation syncing

### Required Environment Variables for Deployment

- `DATABASE_URL`: Your Supabase PostgreSQL connection string
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase service role key
- `EAS_ENDPOINT_ARBITRUM`: GraphQL endpoint for Arbitrum
- `EAS_ENDPOINT_CELO`: GraphQL endpoint for Celo
- `EAS_ENDPOINT_SEPOLIA`: GraphQL endpoint for Sepolia
- `EAS_ENDPOINT_BASE`: GraphQL endpoint for Base
- `EAS_SCHEMA_UID`: Schema UID for location proof attestations
- `EAS_SCHEMA_RAW_STRING`: Raw schema string for location proof attestations
- `NODE_ENV`: Set to "production" for deployment

See `.env.example` for reference.