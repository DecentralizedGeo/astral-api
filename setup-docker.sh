#!/bin/bash

echo "🌟 Astral API Docker Setup Script"
echo "================================="

# Check if .env file exists in backend directory
if [ ! -f "./backend/.env" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp ./backend/.env.example ./backend/.env
    echo "✅ .env file created at ./backend/.env"
    echo ""
    echo "⚠️  IMPORTANT: Please update ./backend/.env with your configuration:"
    echo "   - SUPABASE_URL: Your Supabase project URL"
    echo "   - SUPABASE_KEY: Your Supabase anon key"
    echo "   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key"
    echo "   - DATABASE_URL: Your database connection string"
    echo ""
    echo "📖 For Supabase setup instructions, see: ./SUPABASE-SETUP.md"
    echo ""
    echo "🔧 Once you've updated the .env file, run:"
    echo "   docker compose up --build"
    echo ""
else
    echo "✅ .env file already exists at ./backend/.env"
    echo ""
    echo "🚀 Ready to start! Run:"
    echo "   docker compose up --build"
    echo ""
fi

# Show current configuration status
echo "📋 Current Configuration Status:"
echo "--------------------------------"

if grep -q "your-project-id" ./backend/.env 2>/dev/null; then
    echo "❌ SUPABASE_URL: Not configured (contains placeholder)"
else
    echo "✅ SUPABASE_URL: Configured"
fi

if grep -q "your-anon-key" ./backend/.env 2>/dev/null; then
    echo "❌ SUPABASE_KEY: Not configured (contains placeholder)"
else
    echo "✅ SUPABASE_KEY: Configured"
fi

if grep -q "your-service-role-key" ./backend/.env 2>/dev/null; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY: Not configured (contains placeholder)"
else
    echo "✅ SUPABASE_SERVICE_ROLE_KEY: Configured"
fi

echo ""
echo "🔗 Helpful links:"
echo "   - Documentation: ./docs/"
echo "   - Supabase Setup: ./SUPABASE-SETUP.md"
echo "   - Troubleshooting: ./docs/troubleshooting.md"
