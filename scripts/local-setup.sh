#!/bin/bash
# ============================================================================
# Local Development Setup Script
# ============================================================================
# Sets up the Docker multi-tenant stack locally for development/testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.local.yml"

log_info "Project root: $PROJECT_ROOT"
log_info "Docker Compose file: $DOCKER_COMPOSE_FILE"

# ============================================================================
# VERIFY PREREQUISITES
# ============================================================================

log_info "Verifying prerequisites..."

if ! command -v docker &> /dev/null; then
  log_error "Docker is not installed"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  log_error "Docker Compose is not installed"
  exit 1
fi

log_success "Docker $(docker --version | awk '{print $3}') found"
log_success "Docker Compose $(docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') found"

# ============================================================================
# CHECK IF CONTAINERS ARE ALREADY RUNNING
# ============================================================================

if docker compose -f "$DOCKER_COMPOSE_FILE" ps 2>/dev/null | grep -q "Up"; then
  log_warning "Containers are already running"
  echo ""
  echo "Running containers:"
  docker compose -f "$DOCKER_COMPOSE_FILE" ps
  echo ""
  echo "To stop them: docker compose -f docker-compose.local.yml down"
  echo "To view logs: docker compose -f docker-compose.local.yml logs -f"
  exit 0
fi

# ============================================================================
# BUILD DOCKER IMAGE
# ============================================================================

log_info "Building Docker image (this may take a few minutes)..."

# Use the simplified Dockerfile that assumes npm run build:prod has been run
if docker build -f "$PROJECT_ROOT/Dockerfile.multitenant.simple" \
  -t sixty-sales-dashboard:multitenant \
  -t sixty-sales-dashboard:latest \
  "$PROJECT_ROOT" > /tmp/docker-build.log 2>&1; then
  log_success "Docker image built successfully"
else
  log_error "Docker build failed. Check /tmp/docker-build.log for details"
  tail -50 /tmp/docker-build.log
  exit 1
fi

# ============================================================================
# START CONTAINERS
# ============================================================================

log_info "Starting containers..."

cd "$PROJECT_ROOT"

if docker compose -f "$DOCKER_COMPOSE_FILE" up -d; then
  log_success "Containers started successfully"
else
  log_error "Failed to start containers"
  docker compose -f "$DOCKER_COMPOSE_FILE" logs
  exit 1
fi

# ============================================================================
# WAIT FOR SERVICES TO BE HEALTHY
# ============================================================================

log_info "Waiting for services to be healthy..."

# Wait for database
log_info "Waiting for PostgreSQL..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker compose -f "$DOCKER_COMPOSE_FILE" exec -T db pg_isready -U dev_user -d saas_dev > /dev/null 2>&1; then
    log_success "PostgreSQL is ready"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    log_error "PostgreSQL failed to start after ${max_attempts} attempts"
    docker compose -f "$DOCKER_COMPOSE_FILE" logs db
    exit 1
  fi
  sleep 1
done

# Wait for Redis
log_info "Waiting for Redis..."
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
    log_success "Redis is ready"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    log_error "Redis failed to start after ${max_attempts} attempts"
    docker compose -f "$DOCKER_COMPOSE_FILE" logs redis
    exit 1
  fi
  sleep 1
done

# Wait for application
log_info "Waiting for application..."
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    log_success "Application is ready"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    log_warning "Application health check not responding yet (may still be starting)"
    break
  fi
  sleep 1
done

# ============================================================================
# VERIFY CONTAINERS ARE HEALTHY
# ============================================================================

log_info "Checking container status..."
docker compose -f "$DOCKER_COMPOSE_FILE" ps

# ============================================================================
# DISPLAY INSTRUCTIONS
# ============================================================================

cat << EOF

${GREEN}════════════════════════════════════════════════════════${NC}
${GREEN}✅ LOCAL DEVELOPMENT ENVIRONMENT READY!${NC}
${GREEN}════════════════════════════════════════════════════════${NC}

${BLUE}Services Running:${NC}
  • PostgreSQL: localhost:5432
  • Redis: localhost:6379
  • Express App: http://localhost:3000
  • Worker: Running in background

${BLUE}Database Details:${NC}
  • Host: localhost
  • Port: 5432
  • User: dev_user
  • Password: dev_password
  • Database: saas_dev

${BLUE}API Endpoints:${NC}
  • Health: curl http://localhost:3000/api/health
  • Ready: curl http://localhost:3000/api/ready

${BLUE}Useful Commands:${NC}
  • View logs: docker compose -f docker-compose.local.yml logs -f
  • View app logs: docker compose -f docker-compose.local.yml logs -f app
  • Stop services: docker compose -f docker-compose.local.yml down
  • Restart services: docker compose -f docker-compose.local.yml restart
  • Check status: docker compose -f docker-compose.local.yml ps
  • Database shell: psql -h localhost -U dev_user -d saas_dev
  • Redis shell: redis-cli -h localhost

${BLUE}Frontend Development:${NC}
  • Start Vite dev server: npm run dev
  • In another terminal, the Express backend is already running
  • Changes to frontend will hot-reload
  • Changes to backend require restart: docker compose -f docker-compose.local.yml restart app

${BLUE}Database Access:${NC}
  • View tables: psql -h localhost -U dev_user -d saas_dev -c "\\dt"
  • View organizations: psql -h localhost -U dev_user -d saas_dev -c "SELECT * FROM organizations;"
  • Query deals: psql -h localhost -U dev_user -d saas_dev -c "SELECT * FROM deals;"

${GREEN}════════════════════════════════════════════════════════${NC}

${YELLOW}💡 TIP: To test the multi-tenant provisioning system:${NC}
   ./scripts/provision-customer.sh --id test-customer --name "Test Customer"

${YELLOW}💡 TIP: Check container logs if something isn't working:${NC}
   docker compose -f docker-compose.local.yml logs [service-name]

${GREEN}════════════════════════════════════════════════════════${NC}

EOF

log_success "Setup complete! Your local environment is ready for development."

exit 0
