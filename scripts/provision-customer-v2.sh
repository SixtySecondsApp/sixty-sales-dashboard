#!/bin/bash

################################################################################
# CUSTOMER PROVISIONING SCRIPT v2
################################################################################
#
# Automates complete customer onboarding:
#  1. Creates new PostgreSQL database with unique credentials
#  2. Initializes customer database with complete schema
#  3. Registers customer in Admin DB (saas_admin)
#  4. Generates API keys for the customer
#  5. Creates docker-compose.yml for the customer (optional)
#  6. Outputs customer manifest with all details
#
# Usage:
#   ./scripts/provision-customer-v2.sh \
#     --id acme-corp \
#     --name "ACME Corporation" \
#     --email admin@acme.com \
#     --plan pro \
#     --modules crm_core,advanced_pipeline,ai_assistant
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

################################################################################
# CONFIGURATION
################################################################################

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/scripts"

# Admin DB connection (must match docker-compose.local.yml)
ADMIN_DB_HOST="${ADMIN_DB_HOST:-localhost}"
ADMIN_DB_PORT="${ADMIN_DB_PORT:-5433}"
ADMIN_DB_USER="${ADMIN_DB_USER:-admin_user}"
ADMIN_DB_PASSWORD="${ADMIN_DB_PASSWORD:-admin_password}"
ADMIN_DB_NAME="${ADMIN_DB_NAME:-saas_admin}"

# Default values
DEFAULT_PLAN="starter"
DEFAULT_TIMEZONE="UTC"

# Directories
CUSTOMERS_DIR="$PROJECT_ROOT/customers"
DOCKER_COMPOSE_TEMPLATE="$PROJECT_ROOT/docker-compose.customer.template.yml"

################################################################################
# PARSE ARGUMENTS
################################################################################

CUSTOMER_ID=""
CUSTOMER_NAME=""
CUSTOMER_EMAIL=""
PLAN="${DEFAULT_PLAN}"
MODULES=""
TIMEZONE="${DEFAULT_TIMEZONE}"
USE_OUR_KEYS="true"
BASE_PORT=5434

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
    --email)
      CUSTOMER_EMAIL="$2"
      shift 2
      ;;
    --plan)
      PLAN="$2"
      shift 2
      ;;
    --modules)
      MODULES="$2"
      shift 2
      ;;
    --timezone)
      TIMEZONE="$2"
      shift 2
      ;;
    --base-port)
      BASE_PORT="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

################################################################################
# VALIDATION
################################################################################

log_info "Validating input parameters..."

# Validate customer ID (alphanumeric, hyphens, underscores only)
if [[ -z "$CUSTOMER_ID" ]]; then
  log_error "Customer ID is required (--id)"
  exit 1
fi

if ! [[ "$CUSTOMER_ID" =~ ^[a-z0-9_-]+$ ]]; then
  log_error "Customer ID must contain only lowercase letters, numbers, hyphens, and underscores"
  exit 1
fi

# Validate customer name
if [[ -z "$CUSTOMER_NAME" ]]; then
  log_error "Customer name is required (--name)"
  exit 1
fi

# Validate email
if [[ -z "$CUSTOMER_EMAIL" ]]; then
  log_error "Customer email is required (--email)"
  exit 1
fi

if ! [[ "$CUSTOMER_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  log_error "Invalid email format: $CUSTOMER_EMAIL"
  exit 1
fi

# Validate plan
if ! [[ "$PLAN" =~ ^(starter|pro|enterprise)$ ]]; then
  log_error "Plan must be one of: starter, pro, enterprise"
  exit 1
fi

log_success "Input validation passed"

################################################################################
# CHECK ADMIN DB CONNECTION
################################################################################

log_info "Checking Admin database connection..."

if ! PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" -p "$ADMIN_DB_PORT" \
  -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
  log_error "Cannot connect to Admin database at $ADMIN_DB_HOST:$ADMIN_DB_PORT"
  log_error "Please ensure Admin DB is running and accessible"
  exit 1
fi

log_success "Connected to Admin database"

################################################################################
# CHECK CUSTOMER DOESN'T ALREADY EXIST
################################################################################

log_info "Checking if customer already exists..."

EXISTING_CUSTOMER=$(PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
  -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
  -t -c "SELECT id FROM admin_customers WHERE company_domain = '$CUSTOMER_ID' AND deleted_at IS NULL")

if [[ -n "$EXISTING_CUSTOMER" ]]; then
  log_error "Customer with ID '$CUSTOMER_ID' already exists"
  exit 1
fi

log_success "Customer ID is available"

################################################################################
# FIND AVAILABLE PORT FOR CUSTOMER DATABASE
################################################################################

log_info "Finding available port for customer database..."

CUSTOMER_PORT=$BASE_PORT

# Keep incrementing until we find an available port
while netstat -tuln 2>/dev/null | grep -q ":$CUSTOMER_PORT "; do
  CUSTOMER_PORT=$((CUSTOMER_PORT + 1))
done

log_success "Using port $CUSTOMER_PORT for customer database"

################################################################################
# GENERATE CREDENTIALS
################################################################################

log_info "Generating customer credentials..."

# Generate cryptographically secure passwords
CUSTOMER_DB_USER="${CUSTOMER_ID}_user"
CUSTOMER_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n=')
CUSTOMER_DB_NAME="${CUSTOMER_ID}_db"
CUSTOMER_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n=')
CUSTOMER_REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n=')

# Generate first API key
API_KEY_NAME="default"
API_KEY_PREFIX="sk_${CUSTOMER_ID:0:5}_"
API_KEY_FULL="${API_KEY_PREFIX}$(openssl rand -hex 24)"
API_KEY_HASH=$(echo -n "$API_KEY_FULL" | sha256sum | cut -d' ' -f1)

log_success "Credentials generated"

################################################################################
# CREATE CUSTOMER DIRECTORY STRUCTURE
################################################################################

log_info "Creating customer directory structure..."

CUSTOMER_DIR="$CUSTOMERS_DIR/$CUSTOMER_ID"

# Check if directory already exists
if [[ -d "$CUSTOMER_DIR" ]]; then
  log_error "Customer directory already exists at $CUSTOMER_DIR"
  exit 1
fi

mkdir -p "$CUSTOMER_DIR"/{data/postgres,data/redis,logs,backups}

log_success "Directory structure created at $CUSTOMER_DIR"

################################################################################
# CREATE .ENV FILE FOR CUSTOMER
################################################################################

log_info "Creating .env file for customer..."

ENV_FILE="$CUSTOMER_DIR/.env"

cat > "$ENV_FILE" << EOF
# Customer: $CUSTOMER_NAME
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Customer Identification
CUSTOMER_ID=$CUSTOMER_ID
CUSTOMER_NAME=$CUSTOMER_NAME
CUSTOMER_EMAIL=$CUSTOMER_EMAIL
CUSTOMER_PLAN=$PLAN
CUSTOMER_TIMEZONE=$TIMEZONE

# Database Configuration
DB_HOST=db-$CUSTOMER_ID
DB_PORT=5432
DB_NAME=$CUSTOMER_DB_NAME
DB_USER=$CUSTOMER_DB_USER
DB_PASSWORD=$CUSTOMER_DB_PASSWORD
DATABASE_URL=postgresql://$CUSTOMER_DB_USER:$CUSTOMER_DB_PASSWORD@db-$CUSTOMER_ID:5432/$CUSTOMER_DB_NAME

# Redis Configuration
REDIS_HOST=redis-$CUSTOMER_ID
REDIS_PORT=6379
REDIS_PASSWORD=$CUSTOMER_REDIS_PASSWORD
REDIS_URL=redis://:$CUSTOMER_REDIS_PASSWORD@redis-$CUSTOMER_ID:6379

# Security
JWT_SECRET=$CUSTOMER_JWT_SECRET
JWT_EXPIRY=7d

# Feature Modules
USE_CUSTOMER_AI_KEYS=false

# Port (external)
EXTERNAL_PORT=$((CUSTOMER_PORT + 100))

# Logging
LOG_LEVEL=info
EOF

log_success ".env file created"

################################################################################
# CREATE DOCKER COMPOSE FOR CUSTOMER (LOCAL DEV ONLY)
################################################################################

log_info "Creating docker-compose.yml for customer (local development)..."

DOCKER_COMPOSE_FILE="$CUSTOMER_DIR/docker-compose.yml"

cat > "$DOCKER_COMPOSE_FILE" << 'DOCKEREOF'
version: '3.9'

services:
  # PostgreSQL Database for this customer
  db:
    image: postgres:16-alpine
    container_name: customer-${CUSTOMER_ID}-db
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --lc-collate=C --lc-ctype=C"

    ports:
      - "${CUSTOMER_PORT}:5432"

    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      # Use init script from project root
      - ../../scripts/init-customer-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro

    networks:
      - customer-${CUSTOMER_ID}

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Redis for caching and job queue
  redis:
    image: redis:7-alpine
    container_name: customer-${CUSTOMER_ID}-redis
    restart: unless-stopped

    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru

    ports:
      - "${CUSTOMER_PORT+1}:6379"

    volumes:
      - ./data/redis:/data

    networks:
      - customer-${CUSTOMER_ID}

    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

networks:
  customer-${CUSTOMER_ID}:
    driver: bridge
    name: customer-${CUSTOMER_ID}

volumes:
  postgres-data:
  redis-data:
DOCKEREOF

log_success "docker-compose.yml created at $DOCKER_COMPOSE_FILE"

################################################################################
# INSERT CUSTOMER INTO ADMIN DATABASE
################################################################################

log_info "Registering customer in Admin database..."

# PostgreSQL command to insert customer
# Note: For development, storing plain password. In production, use pgp_sym_encrypt
ADMIN_INSERT_SQL="
INSERT INTO admin_customers (
  company_name, company_domain, subscription_plan, subscription_status,
  billing_email, database_host, database_port, database_name,
  database_user, database_password_encrypted,
  clerk_org_id, clerk_admin_user_id,
  use_customer_ai_keys, timezone,
  trial_started_at, trial_ends_at, created_at
) VALUES (
  '$CUSTOMER_NAME',
  '$CUSTOMER_ID',
  '$PLAN',
  'trial',
  '$CUSTOMER_EMAIL',
  'db-$CUSTOMER_ID',
  5432,
  '$CUSTOMER_DB_NAME',
  '$CUSTOMER_DB_USER',
  '$CUSTOMER_DB_PASSWORD',
  'clerk_org_${CUSTOMER_ID}',
  'clerk_user_${CUSTOMER_ID}',
  false,
  '$TIMEZONE',
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW()
) RETURNING id;
"

CUSTOMER_UUID=$(PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
  -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
  -t -c "$ADMIN_INSERT_SQL" | tr -d ' ')

if [[ -z "$CUSTOMER_UUID" ]]; then
  log_error "Failed to insert customer into Admin database"
  exit 1
fi

log_success "Customer registered with UUID: $CUSTOMER_UUID"

################################################################################
# ASSIGN DEFAULT FEATURE MODULES
################################################################################

log_info "Assigning default feature modules..."

# Parse modules from --modules argument or use defaults based on plan
if [[ -z "$MODULES" ]]; then
  case "$PLAN" in
    starter)
      MODULES="crm_core,advanced_pipeline"
      ;;
    pro)
      MODULES="crm_core,advanced_pipeline,calendar_integration,workflow_automation"
      ;;
    enterprise)
      MODULES="crm_core,advanced_pipeline,calendar_integration,ai_assistant,workflow_automation,analytics_reporting,api_access"
      ;;
  esac
fi

# For each module, get its ID and insert into admin_customer_modules
IFS=',' read -ra MODULE_ARRAY <<< "$MODULES"
for module_key in "${MODULE_ARRAY[@]}"; do
  module_key=$(echo "$module_key" | xargs) # Trim whitespace

  # Get module ID
  MODULE_ID=$(PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
    -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
    -t -c "SELECT id FROM admin_feature_modules WHERE module_key = '$module_key'" | tr -d ' ')

  if [[ -n "$MODULE_ID" ]]; then
    # Insert customer module assignment
    PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
      -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
      -c "INSERT INTO admin_customer_modules (customer_id, module_id, enabled)
          VALUES ('$CUSTOMER_UUID', '$MODULE_ID', true)
          ON CONFLICT DO NOTHING"

    log_success "  ✓ Module '$module_key' enabled"
  else
    log_warning "  ✗ Module '$module_key' not found"
  fi
done

################################################################################
# CREATE CUSTOMER DATABASE
################################################################################

log_info "Creating customer PostgreSQL database..."

# For local development, we'll create using the main postgres service
# In production, this would create a separate RDS instance or managed database

PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" -p "$ADMIN_DB_PORT" \
  -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
  -c "SELECT 1" > /dev/null 2>&1 || {
  log_error "Cannot create customer database without valid Admin DB connection"
  exit 1
}

log_success "Customer PostgreSQL database configured (will be created with docker-compose)"

################################################################################
# GENERATE API KEYS IN ADMIN DATABASE
################################################################################

log_info "Generating API keys for customer..."

ADMIN_API_KEY_SQL="
INSERT INTO admin_api_keys (
  customer_id, key_hash, key_prefix, name, description,
  permissions, rate_limit_requests, rate_limit_period,
  status, created_at
) VALUES (
  '$CUSTOMER_UUID',
  '$API_KEY_HASH',
  '$API_KEY_PREFIX',
  '$API_KEY_NAME',
  'Default API key for customer',
  '[\"read:*\", \"write:*\", \"execute:workflows\"]',
  1000,
  'month',
  'active',
  NOW()
) RETURNING id;
"

API_KEY_ID=$(PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
  -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
  -t -c "$ADMIN_API_KEY_SQL" | tr -d ' ')

log_success "API key generated with ID: $API_KEY_ID"

################################################################################
# LOG PROVISIONING ACTION IN AUDIT LOG
################################################################################

log_info "Logging provisioning action to audit log..."

AUDIT_SQL="
INSERT INTO admin_audit_logs (
  customer_id, action, resource_type, resource_id,
  new_values, created_at
) VALUES (
  '$CUSTOMER_UUID',
  'customer_created',
  'customer',
  '$CUSTOMER_UUID',
  jsonb_build_object(
    'name', '$CUSTOMER_NAME',
    'email', '$CUSTOMER_EMAIL',
    'plan', '$PLAN',
    'provisioned_by', 'provision-customer-v2.sh'
  ),
  NOW()
)
"

PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" \
  -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" \
  -c "$AUDIT_SQL"

log_success "Audit log entry created"

################################################################################
# CREATE MANIFEST FILE
################################################################################

log_info "Creating customer manifest..."

MANIFEST_FILE="$CUSTOMER_DIR/MANIFEST.md"

cat > "$MANIFEST_FILE" << EOF
# Customer Provisioning Manifest

**Customer ID:** $CUSTOMER_ID
**Customer Name:** $CUSTOMER_NAME
**Email:** $CUSTOMER_EMAIL
**Plan:** $PLAN
**Timezone:** $TIMEZONE
**UUID:** $CUSTOMER_UUID
**Created:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

---

## Database Configuration

### Customer Database
- **Host:** db-$CUSTOMER_ID (Docker service name)
- **External Host:** localhost
- **Port:** $CUSTOMER_PORT
- **Database:** $CUSTOMER_DB_NAME
- **Username:** $CUSTOMER_DB_USER
- **Password:** [Stored in .env file]
- **Connection String:** postgresql://$CUSTOMER_DB_USER:\${DB_PASSWORD}@db-$CUSTOMER_ID:5432/$CUSTOMER_DB_NAME

### Redis Cache
- **Host:** redis-$CUSTOMER_ID
- **Port:** $((CUSTOMER_PORT + 1))
- **Password:** [Stored in .env file]

---

## API Configuration

### Default API Key
- **Key ID:** $API_KEY_ID
- **Key Prefix:** $API_KEY_PREFIX
- **Full Key:** $API_KEY_FULL ⚠️ **Save this - it cannot be retrieved later**
- **Rate Limit:** 1000 requests/month
- **Permissions:** read:*, write:*, execute:workflows

**How to use:**
```bash
curl -H "Authorization: Bearer $API_KEY_FULL" \\
  https://api.your-domain.com/api/deals
```

---

## Feature Modules Enabled

$(echo "$MODULES" | tr ',' '\n' | sed 's/^/- /')

---

## Directory Structure

\`\`\`
customers/$CUSTOMER_ID/
├── .env                    # Customer configuration
├── docker-compose.yml      # Local development setup
├── MANIFEST.md             # This file
├── data/
│   ├── postgres/           # Database storage
│   └── redis/              # Cache storage
├── logs/                   # Application logs
└── backups/                # Database backups
\`\`\`

---

## Quick Start (Local Development)

### 1. Start Customer Services

\`\`\`bash
cd customers/$CUSTOMER_ID
docker-compose up -d
\`\`\`

### 2. Verify Database is Ready

\`\`\`bash
psql -h localhost -p $CUSTOMER_PORT -U $CUSTOMER_DB_USER -d $CUSTOMER_DB_NAME
\`\`\`

### 3. View Logs

\`\`\`bash
docker-compose logs -f
\`\`\`

### 4. Access Application

- **Frontend:** http://localhost:\$EXTERNAL_PORT
- **API:** http://localhost:\$EXTERNAL_PORT/api/health

---

## Admin Database Records

The following records have been created in the Admin database (saas_admin):

### admin_customers
- **ID:** $CUSTOMER_UUID
- **Domain:** $CUSTOMER_ID
- **Status:** trial (14-day trial)
- **Database:** $CUSTOMER_DB_NAME

### admin_customer_modules
- Entries created for: $MODULES

### admin_api_keys
- **ID:** $API_KEY_ID
- **Status:** active
- **Rate Limit:** 1000 requests/month

### admin_audit_logs
- Provisioning action logged

---

## Next Steps

1. **Test Database Connection**
   \`\`\`bash
   psql -h localhost -p $CUSTOMER_PORT -U $CUSTOMER_DB_USER -d $CUSTOMER_DB_NAME -c "SELECT version();"
   \`\`\`

2. **Verify Tables Exist**
   \`\`\`bash
   psql -h localhost -p $CUSTOMER_PORT -U $CUSTOMER_DB_USER -d $CUSTOMER_DB_NAME -c "\\\\dt"
   \`\`\`

3. **Test API Key**
   \`\`\`bash
   curl -H "Authorization: Bearer $API_KEY_FULL" \\
     http://localhost:\$EXTERNAL_PORT/api/health
   \`\`\`

4. **Update Clerk Integration**
   - Link Clerk organization to customer ID: $CUSTOMER_ID
   - Set Clerk org ID in admin_customers table

5. **Configure Custom AI Keys (if needed)**
   - If customer wants to bring their own AI keys, update:
   \`\`\`sql
   UPDATE admin_customers SET use_customer_ai_keys = true
   WHERE id = '$CUSTOMER_UUID';
   \`\`\`
   - Then insert their keys:
   \`\`\`sql
   INSERT INTO admin_customer_ai_keys (customer_id, ai_provider, api_key_encrypted, is_active)
   VALUES ('$CUSTOMER_UUID', 'openai', pgp_sym_encrypt('sk-...', 'encryption-key'), true);
   \`\`\`

---

## Security Notes

⚠️ **IMPORTANT:** This manifest contains sensitive information. Store it securely.

### Credentials
- Database password is in `.env` file (should be encrypted in production)
- API key shown above should be saved by the customer immediately
- Redis password is in `.env` file

### Production Deployment
- Use AWS Secrets Manager or HashiCorp Vault for credential storage
- Encrypt passwords using pgcrypto extension
- Rotate API keys regularly
- Use SSL/TLS for all connections

---

## Support & Troubleshooting

### Database Connection Issues
\`\`\`bash
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs db

# Test connection from host
psql -h localhost -p $CUSTOMER_PORT -U $CUSTOMER_DB_USER -d $CUSTOMER_DB_NAME
\`\`\`

### API Key Validation
The API key is stored as a SHA256 hash in the database. When a request comes in with the API key, the backend:
1. Computes SHA256 hash of the provided key
2. Looks up the hash in admin_api_keys
3. Validates customer ID and permissions
4. Logs usage to admin_api_usage

### View Customer in Admin Database

\`\`\`bash
# From localhost
psql -h localhost -p 5433 -U admin_user -d saas_admin

# Query customer
SELECT company_name, subscription_status, created_at
FROM admin_customers
WHERE id = '$CUSTOMER_UUID';

# View enabled modules
SELECT acm.id, afm.module_name
FROM admin_customer_modules acm
JOIN admin_feature_modules afm ON acm.module_id = afm.id
WHERE acm.customer_id = '$CUSTOMER_UUID';

# View API keys
SELECT key_prefix, name, rate_limit_requests, status
FROM admin_api_keys
WHERE customer_id = '$CUSTOMER_UUID';
\`\`\`

---

**Generated by:** provision-customer-v2.sh
**Generation Time:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

EOF

log_success "Manifest created at $MANIFEST_FILE"

################################################################################
# CREATE BACKUP OF CREDENTIALS
################################################################################

log_info "Creating encrypted backup of credentials..."

BACKUP_FILE="$CUSTOMER_DIR/backups/credentials-$(date +%Y%m%d-%H%M%S).txt.gpg"

cat > "$CUSTOMER_DIR/backups/credentials-plain.txt" << CREDEOF
Customer ID: $CUSTOMER_ID
UUID: $CUSTOMER_UUID
Database Password: $CUSTOMER_DB_PASSWORD
Redis Password: $CUSTOMER_REDIS_PASSWORD
API Key: $API_KEY_FULL
JWT Secret: $CUSTOMER_JWT_SECRET
CREDEOF

# Encrypt with GPG (if available)
if command -v gpg &> /dev/null; then
  gpg --symmetric --cipher-algo AES256 \
    --output "$BACKUP_FILE" \
    "$CUSTOMER_DIR/backups/credentials-plain.txt"

  rm "$CUSTOMER_DIR/backups/credentials-plain.txt"
  log_success "Encrypted credentials backup created"
else
  log_warning "GPG not found - credentials saved as plain text (not recommended for production)"
fi

################################################################################
# OUTPUT SUMMARY
################################################################################

cat << EOF

${GREEN}════════════════════════════════════════════════════════════════${NC}
${GREEN}✅ CUSTOMER PROVISIONING COMPLETE${NC}
${GREEN}════════════════════════════════════════════════════════════════${NC}

${BLUE}Customer Information:${NC}
  Name:        $CUSTOMER_NAME
  ID:          $CUSTOMER_ID
  UUID:        $CUSTOMER_UUID
  Email:       $CUSTOMER_EMAIL
  Plan:        $PLAN
  Timezone:    $TIMEZONE

${BLUE}Database Access:${NC}
  Host:        localhost
  Port:        $CUSTOMER_PORT
  Database:    $CUSTOMER_DB_NAME
  Username:    $CUSTOMER_DB_USER
  JDBC URL:    jdbc:postgresql://localhost:$CUSTOMER_PORT/$CUSTOMER_DB_NAME

${BLUE}API Key:${NC}
  Key:         $API_KEY_FULL
  Rate Limit:  1000 requests/month
  Status:      Active

${BLUE}Directory:${NC}
  Location:    $CUSTOMER_DIR
  Config:      $CUSTOMER_DIR/.env
  Manifest:    $CUSTOMER_DIR/MANIFEST.md
  Compose:     $CUSTOMER_DIR/docker-compose.yml

${BLUE}Feature Modules:${NC}
$(echo "$MODULES" | tr ',' '\n' | sed "s/^/  - /")

${YELLOW}⚠️  IMPORTANT:${NC}
  1. Save the API Key immediately - it cannot be retrieved later
  2. Store credentials securely - consider using a secrets manager
  3. Review the MANIFEST.md file for all details
  4. For production, encrypt credentials and use managed databases

${BLUE}Next Steps:${NC}
  1. Update Clerk with customer ID: $CUSTOMER_ID
  2. Share MANIFEST.md with customer (remove sensitive fields)
  3. Customer confirms account setup and begins using platform

${GREEN}════════════════════════════════════════════════════════════════${NC}

EOF

log_success "Provisioning script completed successfully!"

exit 0
