#!/bin/bash

echo "🔍 Verifying Astral API Docker Setup"
echo "==================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Check if .env file exists
if [ ! -f "./backend/.env" ]; then
    echo "❌ .env file not found. Run setup-docker.sh first."
    exit 1
fi

echo "✅ .env file exists"

# Check if docker-compose.yml exists
if [ ! -f "./docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    exit 1
fi

echo "✅ docker-compose.yml exists"

# Test build
echo "🔨 Testing Docker build..."
if docker compose build api; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    exit 1
fi

echo ""
echo "🎉 All checks passed! Your Docker setup is ready."
echo "🚀 Run 'docker compose up' to start the API"
