#!/bin/bash
set -e

echo "🚀 Starting Astral API Docker initialization..."

# Function to wait for database to be ready
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if node -e "
            const { createClient } = require('@supabase/supabase-js');
            const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
            client.from('_test').select('*').limit(1)
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
        " 2>/dev/null; then
            echo "✅ Database is ready!"
            return 0
        fi
        echo "⏳ Database not ready yet, retrying in 2 seconds... ($retries attempts left)"
        sleep 2
        retries=$((retries - 1))
    done
    echo "❌ Database connection failed after 60 seconds"
    exit 1
}

# Function to check if .env exists, if not copy from .env.example
setup_env() {
    if [ ! -f .env ]; then
        echo "📝 Creating .env file from .env.example..."
        cp .env.example .env
        echo "⚠️  Please update .env with your actual configuration values"
    else
        echo "✅ .env file already exists"
    fi
}

# Function to setup database
setup_database() {
    echo "🗄️  Setting up database..."
    if npm run db:setup; then
        echo "✅ Database setup completed"
    else
        echo "⚠️  Database setup failed or already exists"
    fi
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    if npm run db:migrate; then
        echo "✅ Database migrations completed"
    else
        echo "⚠️  Database migrations failed or already applied"
    fi
}

# Function to validate schema
validate_schema() {
    echo "🔍 Validating database schema..."
    if npm run db:validate; then
        echo "✅ Database schema validation passed"
    else
        echo "⚠️  Database schema validation failed"
    fi
}

# Function to ingest initial data (optional)
ingest_initial_data() {
    if [ "$SKIP_INITIAL_INGEST" != "true" ]; then
        echo "📥 Running initial attestation ingestion..."
        if timeout 30 npm run ingest; then
            echo "✅ Initial ingestion completed"
        else
            echo "⚠️  Initial ingestion timed out or failed (this is normal for first run)"
        fi
    else
        echo "⏭️  Skipping initial ingestion (SKIP_INITIAL_INGEST=true)"
    fi
}

# Main initialization sequence
main() {
    echo "🌟 Astral API Docker Initialization Script"
    echo "=========================================="
    
    # Setup environment
    setup_env
    
    # Wait for database to be available
    wait_for_db
    
    # Setup database
    setup_database
    
    # Run migrations
    run_migrations
    
    # Validate schema
    validate_schema
    
    # Ingest initial data (optional)
    ingest_initial_data
    
    echo "✅ Initialization completed successfully!"
    echo "🚀 Starting API server..."
    
    # Start the API server
    exec npm start
}

# Handle graceful shutdown
trap 'echo "🛑 Shutting down..."; exit 0' SIGTERM SIGINT

# Only run main if API_ONLY is not true
if [ "$API_ONLY" != "true" ]; then
    # Run main function
    main
else
    echo "API_ONLY=true detected, skipping backend initialization steps."
    exec npm start
fi
