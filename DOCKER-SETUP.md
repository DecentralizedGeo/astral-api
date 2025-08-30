# Docker Setup Guide

This guide will help you get the Astral API running with Docker with complete automation of all setup steps.

## Quick Start

1. **Prepare your environment:**
   ```bash
   # Windows (PowerShell)
   .\setup-docker.ps1
   
   # macOS/Linux
   ./setup-docker.sh
   ```

2. **Configure your environment:**
   - Edit `./backend/.env` with your Supabase credentials
   - See `./SUPABASE-SETUP.md` for detailed setup instructions

3. **Start the API:**
   ```bash
   docker compose up --build
   ```

4. **Verify the API is running:**
   - Open http://localhost:3000 in your browser
   - Check http://localhost:3000/health for health status

## What Happens During Docker Startup

The Docker container automatically handles all the manual setup steps from the README:

1. **Environment Setup**: Copies `.env.example` to `.env` if it doesn't exist
2. **Database Connection**: Waits for the database to be ready
3. **Database Setup**: Runs `npm run db:setup` to create the database schema
4. **Migrations**: Runs `npm run db:migrate` to apply database migrations
5. **Schema Validation**: Runs `npm run db:validate` to ensure schema is correct
6. **Initial Data Ingestion**: Runs `npm run ingest` to populate initial attestation data
7. **API Server**: Starts the API server with `npm start`

## Environment Variables

Make sure these are configured in `./backend/.env`:

```bash
# Database Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgres://postgres:password@db:5432/astral

# API Configuration
PORT=3000
NODE_ENV=development

# EAS Configuration (pre-configured)
EAS_ENDPOINT_ARBITRUM=https://arbitrum.easscan.org/graphql
EAS_ENDPOINT_CELO=https://celo.easscan.org/graphql
EAS_ENDPOINT_SEPOLIA=https://sepolia.easscan.org/graphql
EAS_ENDPOINT_BASE=https://base.easscan.org/graphql
EAS_SCHEMA_UID=0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2
```

## Configuration Options

You can customize the Docker behavior with these environment variables:

- `SKIP_INITIAL_INGEST=true`: Skip the initial attestation ingestion for faster startup

Example:
```bash
# In docker-compose.yml, set:
environment:
  - SKIP_INITIAL_INGEST=true
```

## Troubleshooting

### Container fails to start
1. Check your `.env` file configuration
2. Verify Supabase credentials are correct
3. Check Docker logs: `docker compose logs api`

### Database connection fails
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
2. Check if your Supabase project is running
3. Verify network connectivity to Supabase

### Initial ingestion times out
This is normal for the first run. The container will continue and start the API server. You can manually run ingestion later:

```bash
# Enter the running container
docker compose exec api bash

# Run ingestion manually
npm run ingest
```

## Development Commands

Once the container is running, you can execute commands inside it:

```bash
# Access the container shell
docker compose exec api bash

# Run tests
docker compose exec api npm test

# Run additional ingestion
docker compose exec api npm run ingest

# Start the EAS worker
docker compose exec api npm run worker:eas
```

## Logs and Monitoring

View logs from the running container:

```bash
# View all logs
docker compose logs api

# Follow logs in real-time
docker compose logs -f api

# View last 100 lines
docker compose logs --tail=100 api
```
