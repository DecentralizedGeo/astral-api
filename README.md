# Astral Protocol API

A unified gateway for accessing location proof attestations (EAS attestations) across multiple blockchains. The API serves both OGC-compliant RESTful access for geospatial interoperability and a GraphQL interface for flexible queries.

## Features

- Multi-Chain Attestation Queries: Retrieve location proof attestations from all supported networks
- OGC API – Features Compliance: RESTful interface that complies with the OGC API Features Part 1: Core standard
- GraphQL Proxy (Apollo): Flexible queries for developer-friendly data access
- Supabase Integration: PostgreSQL database with PostGIS extension for geospatial data
- Real-time Attestation Ingestion: Automated background worker that ingests new location proof attestations
- Multi-Chain Support: Currently supports Arbitrum, Celo, Sepolia, and Base networks

## Documentation

For detailed documentation on how to use and integrate with the API:

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Data Model](./docs/data-model.md)
- [Spatial Queries](./docs/spatial-queries.md)
- [OGC API](./docs/ogc-api.md)
- [GraphQL API](./docs/graphql-api.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Production API

The API is deployed and available at:

```
https://api.astral.global
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development without Docker)

### Running with Docker

```bash
# Start the API and database
docker compose up

# API will be available at http://localhost:3000
```

### Local Development

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Set up the database
npm run db:setup
npm run db:migrate

# Start development server with hot reloading
npm run dev

# To manually ingest EAS attestations
npm run ingest

# To run the EAS worker for continuous ingestion
npm run worker:eas
```

## Project Structure

```
astral-api/
├── .ai/                   # AI-assisted design documents
├── backend/               # API server code
│   ├── src/               # Source code
│   │   ├── config/        # Configuration
│   │   ├── controllers/   # API route handlers 
│   │   ├── migrations/    # Database migrations
│   │   ├── models/        # Data models
│   │   ├── scripts/       # Utility scripts
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Utility functions
│   │   └── workers/       # Background workers
│   ├── Dockerfile         # Docker configuration
│   └── package.json       # Dependencies and scripts
└── docker-compose.yml     # Docker services definition
```

## EAS Attestation Ingestion

The system includes a worker (`eas-worker.ts`) that periodically polls EAS indexers across multiple supported blockchains:

- **Supported chains**: Arbitrum, Celo, Sepolia, Base
- **Configuration**: Configure endpoints in `.env` file using the variables `EAS_ENDPOINT_*`
- **Schema UID**: Configure the schema identifier with `EAS_SCHEMA_UID`
- **Polling interval**: Default is every 5 minutes
- **Data format**: Supports location data in "lat,lng" format, with plans for GeoJSON support

Location proof data is stored in the PostgreSQL database and can be queried via REST or GraphQL APIs.

## Deployment

For detailed instructions on deploying the API to Vercel:

- [Vercel Deployment Guide](./backend/VERCEL-DEPLOY.md)
- [Deployment Checklist](./backend/DEPLOYMENT-CHECKLIST.md)

## License

MIT