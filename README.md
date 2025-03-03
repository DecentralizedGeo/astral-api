# Astral Protocol API

A unified gateway for accessing location proof attestations (EAS attestations) across multiple blockchains. The API serves both OGC-compliant RESTful access for geospatial interoperability and a GraphQL interface for flexible queries.

## Features

- Multi-Chain Attestation Queries: Retrieve location proof attestations from all supported networks
- OGC API – Features Compliance: RESTful interface that complies with the OGC API Features Part 1: Core standard
- GraphQL Proxy (Apollo): Flexible queries for developer-friendly data access
- Supabase Integration: PostgreSQL database with PostGIS extension for geospatial data

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

# Start development server with hot reloading
npm run dev
```

## Project Structure

```
astral-api/
├── .ai/                   # AI-assisted design documents
├── backend/               # API server code
│   ├── src/               # Source code
│   │   ├── config/        # Configuration
│   │   ├── controllers/   # API route handlers 
│   │   ├── models/        # Data models
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utility functions
│   ├── Dockerfile         # Docker configuration
│   └── package.json       # Dependencies and scripts
└── docker-compose.yml     # Docker services definition
```

## License

TBD