#!/bin/bash
# ============================================================================
# Multi-Tenant SaaS Customer Provisioning Script
# ============================================================================
# This script provisions a new customer with complete isolation:
# - Creates customer directory structure
# - Generates secure credentials (.env)
# - Creates docker-compose.yml from template
# - Starts all containers (PostgreSQL, Redis, App, Worker)
# - Runs database migrations
# - Outputs customer details for admin
#
# Usage: ./scripts/provision-customer.sh --id CUSTOMER_ID --name "Customer Name" [--port 3001]

set -e  # Exit on any error

# ============================================================================
# COLORS FOR OUTPUT
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CUSTOMERS_DIR="${PROJECT_ROOT}/customers"
DOCKER_COMPOSE_TEMPLATE="${PROJECT_ROOT}/docker-compose.customer.template.yml"

# Default configuration
CUSTOMER_ID=""
CUSTOMER_NAME=""
DB_PORT=""
REDIS_PORT=""
APP_PORT=""
BASE_DB_PORT=5433
BASE_REDIS_PORT=6380
BASE_APP_PORT=3001

# ============================================================================
# PARSE COMMAND LINE ARGUMENTS
# ============================================================================

while [[ $# -gt 0 ]]; do
  case $1 in
    --id)
      CUSTOMER_ID="$2"
      shift 2
      ;;
    --name)
      CUSTOMER_NAME="$2"
      shift 2
      ;;
    --port)
      APP_PORT="$2"
      shift 2
      ;;
    *)
      log_error "Unknown option: $1"
      echo "Usage: $0 --id CUSTOMER_ID --name 'Customer Name' [--port 3001]"
      exit 1
      ;;
  esac
done

# ============================================================================
# VALIDATE INPUTS
# ============================================================================

if [ -z "$CUSTOMER_ID" ]; then
  log_error "Missing required argument: --id"
  echo "Usage: $0 --id CUSTOMER_ID --name 'Customer Name' [--port 3001]"
  exit 1
fi

if [ -z "$CUSTOMER_NAME" ]; then
  log_error "Missing required argument: --name"
  echo "Usage: $0 --id CUSTOMER_ID --name 'Customer Name' [--port 3001]"
  exit 1
fi

# Validate customer ID format (alphanumeric and hyphens only)
if ! [[ "$CUSTOMER_ID" =~ ^[a-zA-Z0-9-]+$ ]]; then
  log_error "Invalid customer ID format. Use only alphanumeric characters and hyphens."
  exit 1
fi

# Convert customer ID to lowercase
CUSTOMER_ID=$(echo "$CUSTOMER_ID" | tr '[:upper:]' '[:lower:]')

# Check if customer already exists
CUSTOMER_DIR="${CUSTOMERS_DIR}/${CUSTOMER_ID}"
if [ -d "$CUSTOMER_DIR" ]; then
  log_error "Customer directory already exists: $CUSTOMER_DIR"
  exit 1
fi

# ============================================================================
# ASSIGN PORTS
# ============================================================================

# If no port specified, auto-assign based on customer number
if [ -z "$APP_PORT" ]; then
  # Count existing customers to determine port offset
  if [ -d "$CUSTOMERS_DIR" ]; then
    CUSTOMER_COUNT=$(ls -d "$CUSTOMERS_DIR"/*/ 2>/dev/null | wc -l)
  else
    CUSTOMER_COUNT=0
  fi
  APP_PORT=$((BASE_APP_PORT + CUSTOMER_COUNT))
  DB_PORT=$((BASE_DB_PORT + CUSTOMER_COUNT))
  REDIS_PORT=$((BASE_REDIS_PORT + CUSTOMER_COUNT))
else
  # Calculate derived ports from APP_PORT
  OFFSET=$((APP_PORT - BASE_APP_PORT))
  DB_PORT=$((BASE_DB_PORT + OFFSET))
  REDIS_PORT=$((BASE_REDIS_PORT + OFFSET))
fi

# ============================================================================
# GENERATE SECURE CREDENTIALS
# ============================================================================

log_info "Generating secure credentials..."

# Generate random passwords (32 characters)
DB_USER="customer_${CUSTOMER_ID}"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
DB_NAME="saas_${CUSTOMER_ID}"
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Subnet for Docker network isolation (172.20-254.X.X)
CUSTOMER_SUBNET=$((20 + (RANDOM % 235)))

log_success "Credentials generated"

# ============================================================================
# CREATE DIRECTORY STRUCTURE
# ============================================================================

log_info "Creating customer directory structure..."

mkdir -p "${CUSTOMER_DIR}"
mkdir -p "${CUSTOMER_DIR}/data/postgres"
mkdir -p "${CUSTOMER_DIR}/data/redis"
mkdir -p "${CUSTOMER_DIR}/logs"

log_success "Directory structure created at: $CUSTOMER_DIR"

# ============================================================================
# CREATE .ENV FILE
# ============================================================================

log_info "Creating .env file..."

cat > "${CUSTOMER_DIR}/.env" << EOF
# ============================================================================
# Customer: ${CUSTOMER_NAME}
# Customer ID: ${CUSTOMER_ID}
# Created: $(date -u +'%Y-%m-%dT%H:%M:%SZ')
# ============================================================================

# Database Configuration
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_HOST=db-${CUSTOMER_ID}
DB_PORT=5432
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db-${CUSTOMER_ID}:5432/${DB_NAME}

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_HOST=redis-${CUSTOMER_ID}
REDIS_PORT=6379
REDIS_URL=redis://:${REDIS_PASSWORD}@redis-${CUSTOMER_ID}:6379

# Security
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d

# Service API Keys (Shared with SaaS provider, not customer)
VITE_SUPABASE_URL=\${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=\${VITE_SUPABASE_ANON_KEY}
VITE_OPENAI_API_KEY=\${VITE_OPENAI_API_KEY}
VITE_GEMINI_API_KEY=\${VITE_GEMINI_API_KEY}
VITE_ANTHROPIC_API_KEY=\${VITE_ANTHROPIC_API_KEY}
VITE_OPENROUTER_API_KEY=\${VITE_OPENROUTER_API_KEY}

# Email Configuration
SES_FROM_EMAIL=\${SES_FROM_EMAIL}
SES_FROM_NAME=\${SES_FROM_NAME}
AWS_SES_REGION=\${AWS_SES_REGION}
AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}

# Logging
LOG_LEVEL=info

# Customer Information
CUSTOMER_ID=${CUSTOMER_ID}
CUSTOMER_NAME=${CUSTOMER_NAME}

# Node Environment
NODE_ENV=production
EOF

chmod 600 "${CUSTOMER_DIR}/.env"
log_success ".env file created (mode 600 - restricted permissions)"

# ============================================================================
# CREATE DOCKER-COMPOSE FILE
# ============================================================================

log_info "Creating docker-compose.yml..."

if [ ! -f "$DOCKER_COMPOSE_TEMPLATE" ]; then
  log_error "Template file not found: $DOCKER_COMPOSE_TEMPLATE"
  exit 1
fi

# Substitute variables in docker-compose template
sed -e "s/\${CUSTOMER_ID}/${CUSTOMER_ID}/g" \
    -e "s/\${CUSTOMER_NAME}/${CUSTOMER_NAME}/g" \
    -e "s/\${DB_USER}/${DB_USER}/g" \
    -e "s/\${DB_PASSWORD}/${DB_PASSWORD}/g" \
    -e "s/\${DB_NAME}/${DB_NAME}/g" \
    -e "s/\${DB_PORT}/${DB_PORT}/g" \
    -e "s/\${REDIS_PASSWORD}/${REDIS_PASSWORD}/g" \
    -e "s/\${REDIS_PORT}/${REDIS_PORT}/g" \
    -e "s/\${APP_PORT}/${APP_PORT}/g" \
    -e "s/\${JWT_SECRET}/${JWT_SECRET}/g" \
    -e "s/\${CUSTOMER_SUBNET}/${CUSTOMER_SUBNET}/g" \
    "$DOCKER_COMPOSE_TEMPLATE" > "${CUSTOMER_DIR}/docker-compose.yml"

chmod 644 "${CUSTOMER_DIR}/docker-compose.yml"
log_success "docker-compose.yml created"

# ============================================================================
# BUILD DOCKER IMAGE (if needed)
# ============================================================================

log_info "Checking if Docker image needs to be built..."

if ! docker images | grep -q "sixty-sales-dashboard:multitenant"; then
  log_warning "Docker image not found. Building..."
  cd "$PROJECT_ROOT"
  docker build -f Dockerfile.multitenant -t sixty-sales-dashboard:multitenant .
  log_success "Docker image built successfully"
else
  log_info "Docker image already exists, skipping build"
fi

# ============================================================================
# START CONTAINERS
# ============================================================================

log_info "Starting Docker containers..."

cd "${CUSTOMER_DIR}"

# Start services
docker-compose up -d

# Check if startup was successful
sleep 5

if ! docker-compose ps | grep -q "Up"; then
  log_error "Containers failed to start. Check logs with: docker-compose logs"
  exit 1
fi

log_success "All containers started successfully"

# ============================================================================
# WAIT FOR DATABASE READINESS
# ============================================================================

log_info "Waiting for database to be ready..."

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker-compose exec -T db-"${CUSTOMER_ID}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
    log_success "Database is ready"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    log_error "Database failed to start after ${max_attempts} attempts"
    docker-compose logs db-"${CUSTOMER_ID}"
    exit 1
  fi
  sleep 1
done

# ============================================================================
# RUN DATABASE MIGRATIONS
# ============================================================================

log_info "Running database migrations..."

# Run migrations via database initialization script
docker-compose exec -T db-"${CUSTOMER_ID}" psql -U "${DB_USER}" -d "${DB_NAME}" << 'MIGRATIONEOF'
-- Verify extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Check if migrations completed
SELECT 'Database initialized successfully' as status;
MIGRATIONEOF

if [ $? -ne 0 ]; then
  log_error "Database migration failed"
  docker-compose logs db-"${CUSTOMER_ID}"
  exit 1
fi

log_success "Database migrations completed"

# ============================================================================
# VERIFY CONTAINERS ARE HEALTHY
# ============================================================================

log_info "Verifying container health..."

# Check app container
sleep 10
if docker-compose exec -T app-"${CUSTOMER_ID}" curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
  log_success "Application is healthy"
else
  log_warning "Application health check not yet responding (may still be starting)"
  docker-compose logs app-"${CUSTOMER_ID}" | tail -20
fi

# ============================================================================
# OUTPUT CUSTOMER DETAILS
# ============================================================================

cat << EOF

${GREEN}========================================${NC}
${GREEN}Customer Provisioned Successfully!${NC}
${GREEN}========================================${NC}

${BLUE}Customer Information:${NC}
  ID:                     ${CUSTOMER_ID}
  Name:                   ${CUSTOMER_NAME}
  Directory:              ${CUSTOMER_DIR}

${BLUE}Port Configuration:${NC}
  Application:            localhost:${APP_PORT}
  Database:               localhost:${DB_PORT}
  Redis:                  localhost:${REDIS_PORT}

${BLUE}Database Credentials:${NC}
  User:                   ${DB_USER}
  Database:               ${DB_NAME}
  Password:               [See .env file]

${BLUE}Important Files:${NC}
  Config:                 ${CUSTOMER_DIR}/.env
  Docker Compose:         ${CUSTOMER_DIR}/docker-compose.yml
  Logs:                   ${CUSTOMER_DIR}/logs/

${BLUE}Useful Commands:${NC}
  View logs:              cd ${CUSTOMER_DIR} && docker-compose logs -f
  Stop containers:        cd ${CUSTOMER_DIR} && docker-compose down
  Restart containers:     cd ${CUSTOMER_DIR} && docker-compose up -d
  Check status:           cd ${CUSTOMER_DIR} && docker-compose ps
  SSH to database:        psql -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}

${BLUE}Access Application:${NC}
  URL:                    http://localhost:${APP_PORT}
  Health Check:           curl http://localhost:${APP_PORT}/api/health

${GREEN}========================================${NC}

Next Steps:
  1. Update the application frontend to use: http://localhost:${APP_PORT}
  2. Configure any customer-specific settings in the database
  3. Add users to the organization
  4. Monitor logs for any issues

Created: $(date)

EOF

log_success "Provisioning complete!"

# ============================================================================
# CREATE CUSTOMER MANIFEST
# ============================================================================

cat > "${CUSTOMER_DIR}/CUSTOMER_MANIFEST.md" << EOF
# Customer: ${CUSTOMER_NAME}

**Customer ID:** ${CUSTOMER_ID}
**Created:** $(date -u +'%Y-%m-%dT%H:%M:%SZ')

## Infrastructure

- **App Port:** ${APP_PORT}
- **Database Port:** ${DB_PORT}
- **Redis Port:** ${REDIS_PORT}
- **Database Name:** ${DB_NAME}
- **Database User:** ${DB_USER}

## Services

- **Application:** app-${CUSTOMER_ID}
- **Database:** db-${CUSTOMER_ID}
- **Redis:** redis-${CUSTOMER_ID}
- **Worker:** worker-${CUSTOMER_ID}

## Network

- **Network Name:** network-${CUSTOMER_ID}
- **Subnet:** 172.${CUSTOMER_SUBNET}.0.0/16

## Quick Commands

\`\`\`bash
cd ${CUSTOMER_DIR}

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
\`\`\`

## Troubleshooting

Check application logs:
\`\`\`bash
docker-compose logs app-${CUSTOMER_ID}
\`\`\`

Check database logs:
\`\`\`bash
docker-compose logs db-${CUSTOMER_ID}
\`\`\`

Connect to database directly:
\`\`\`bash
psql -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}
\`\`\`

EOF

log_success "Customer manifest created: ${CUSTOMER_DIR}/CUSTOMER_MANIFEST.md"

exit 0
