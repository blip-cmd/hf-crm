# scripts/dev/test-docker-local.ps1
# PowerShell local test runner for Windows Docker environments

$ErrorActionPreference = "Stop"

Write-Host "=== ChurchCRM Local Docker Test Suite ===" -ForegroundColor Cyan

# 1. Check Docker daemon
try {
    $null = docker info 2>&1
    Write-Host "-> Docker daemon is healthy." -ForegroundColor Green
} catch {
    Write-Error "ERROR: Docker daemon is not running. Please start Docker Desktop."
    exit 1
}

# 2. Start containers
Write-Host "-> Ensuring test containers are up..." -ForegroundColor Yellow
npm run docker:test:start

# 3. Wait for webserver
Write-Host "-> Checking service availability..." -ForegroundColor Yellow
node scripts/ci/wait-for-server.js http://localhost:8080/index.php 60

# 4. Run database reset
Write-Host "-> Resetting test database..." -ForegroundColor Yellow
npm run docker:test:reset:db

# 5. Run PHP verification inside webserver container
Write-Host "-> Running African Holidays check inside container..." -ForegroundColor Yellow
docker compose -f docker/docker-compose.yaml --profile test exec -T webserver php scripts/test-african-holidays.php

# 6. Run Cypress specs
Write-Host "-> Running Cypress holiday spec..." -ForegroundColor Yellow
npx cypress run --config-file cypress/configs/docker.config.ts --spec "cypress/e2e/api/private/plugins/holidays.spec.js"

Write-Host "=== Local Docker Test Suite Completed Successfully ===" -ForegroundColor Green
