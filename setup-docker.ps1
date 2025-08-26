Write-Host "🌟 Astral API Docker Setup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if .env file exists in backend directory
if (!(Test-Path "./backend/.env")) {
    Write-Host "📝 Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item "./backend/.env.example" "./backend/.env"
    Write-Host "✅ .env file created at ./backend/.env" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Please update ./backend/.env with your configuration:" -ForegroundColor Red
    Write-Host "   - SUPABASE_URL: Your Supabase project URL" -ForegroundColor White
    Write-Host "   - SUPABASE_KEY: Your Supabase anon key" -ForegroundColor White
    Write-Host "   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key" -ForegroundColor White
    Write-Host "   - DATABASE_URL: Your database connection string" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 For Supabase setup instructions, see: ./SUPABASE-SETUP.md" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔧 Once you've updated the .env file, run:" -ForegroundColor Cyan
    Write-Host "   docker compose up --build" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✅ .env file already exists at ./backend/.env" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Ready to start! Run:" -ForegroundColor Cyan
    Write-Host "   docker compose up --build" -ForegroundColor White
    Write-Host ""
}

# Show current configuration status
Write-Host "📋 Current Configuration Status:" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

if (Test-Path "./backend/.env") {
    $envContent = Get-Content "./backend/.env" -Raw
    
    if ($envContent -match "your-project-id") {
        Write-Host "❌ SUPABASE_URL: Not configured (contains placeholder)" -ForegroundColor Red
    } else {
        Write-Host "✅ SUPABASE_URL: Configured" -ForegroundColor Green
    }
    
    if ($envContent -match "your-anon-key") {
        Write-Host "❌ SUPABASE_KEY: Not configured (contains placeholder)" -ForegroundColor Red
    } else {
        Write-Host "✅ SUPABASE_KEY: Configured" -ForegroundColor Green
    }
    
    if ($envContent -match "your-service-role-key") {
        Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY: Not configured (contains placeholder)" -ForegroundColor Red
    } else {
        Write-Host "✅ SUPABASE_SERVICE_ROLE_KEY: Configured" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔗 Helpful links:" -ForegroundColor Cyan
Write-Host "   - Documentation: ./docs/" -ForegroundColor White
Write-Host "   - Supabase Setup: ./SUPABASE-SETUP.md" -ForegroundColor White
Write-Host "   - Troubleshooting: ./docs/troubleshooting.md" -ForegroundColor White
