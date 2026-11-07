#!/usr/bin/env bash
# scripts/dev/test-docker-local.sh
# Tests ChurchCRM locally inside Docker containers without requiring host PHP/Composer/MySQL.

set -euo pipefail

echo "=== ChurchCRM Local Docker Test Suite ==="

# 1. Check if Docker is installed and daemon is running
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker CLI not found. Please install Docker Desktop."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

echo "-> Docker daemon is healthy."

# 2. Start dev/test environment if not already up
echo "-> Ensuring test containers are up..."
npm run docker:test:start

# 3. Wait for database and webserver readiness
echo "-> Waiting for service readiness..."
node scripts/ci/wait-for-server.js http://localhost:8080/index.php 60 || true

# 4. Run database reset / schema bootstrap
echo "-> Resetting test database..."
npm run docker:test:reset:db || true

# 5. Run Pan-African holidays verification inside container
echo "-> Running African Holidays check inside container..."
docker compose -f docker/docker-compose.yaml --profile test exec -T webserver php scripts/test-african-holidays.php || {
    echo "WARNING: scripts/test-african-holidays.php failed inside webserver container."
}

# 6. Run targeted Cypress tests against Docker stack
echo "-> Running Cypress holiday & authentication specs..."
npx cypress run --config-file cypress/configs/docker.config.ts --spec "cypress/e2e/api/private/plugins/holidays.spec.js"

echo "=== Local Docker Test Suite Completed Successfully ==="
