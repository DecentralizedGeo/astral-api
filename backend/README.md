# Astral API Backend

## Setup

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