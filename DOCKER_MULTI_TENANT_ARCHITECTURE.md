# Docker Multi-Tenant Architecture
## Complete Guide to Containerizing for Per-Customer Deployment

**Status:** 🚀 IN PROGRESS
**Priority:** CRITICAL (Foundation for all customers)
**Owner:** DevOps Engineer
**Timeline:** Immediate start

---

## EXECUTIVE SUMMARY

The goal is to **create a Docker-based infrastructure where each new customer gets**:
1. ✅ Their own PostgreSQL database container
2. ✅ Their own application container
3. ✅ Isolated data (no cross-customer access)
4. ✅ Independent scaling
5. ✅ Simple onboarding (deploy script)

**Result:** When customer signs up → 1 script → Complete isolated environment in minutes

---

## HIGH-LEVEL ARCHITECTURE

```
SaaS Control Plane (Main Server)
│
├─ Nginx Reverse Proxy (routes requests to customer containers)
│
├─ Customer 1 Environment
│  ├─ app-customer-1 (Node.js container)
│  ├─ db-customer-1 (PostgreSQL container)
│  └─ redis-customer-1 (Redis container - optional)
│
├─ Customer 2 Environment
│  ├─ app-customer-2 (Node.js container)
│  ├─ db-customer-2 (PostgreSQL container)
│  └─ redis-customer-2 (Redis container)
│
├─ Customer N Environment
│  ├─ app-customer-N (Node.js container)
│  ├─ db-customer-N (PostgreSQL container)
│  └─ redis-customer-N (Redis container)
│
└─ Shared Services (Optional)
   ├─ Redis cluster (for caching across customers)
   ├─ Monitoring (Prometheus, Grafana)
   └─ Logging (ELK or Loki)
```

---

## STEP 1: DOCKERFILE (Multi-Stage Build)

**File: `Dockerfile`**

```dockerfile
# ============================================
# Stage 1: Build Frontend (React/Vite)
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install security patches
RUN apk add --no-cache \
    dumb-init \
    curl

# Create app user (don't run as root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=backend-builder /app/node_modules ./node_modules

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Copy source code (for runtime)
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose ports
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
```

**Key Points:**
- Multi-stage build (smaller final image)
- Non-root user (security)
- Health checks built-in
- Proper signal handling (dumb-init)
- Build size: ~150-200MB (optimized)

---

## STEP 2: Docker Compose (Per-Customer Template)

**File: `docker-compose.customer.yml`**

This is a TEMPLATE that gets customized per customer:

```yaml
version: '3.8'

services:
  # ============================================
  # Application Container (Node.js)
  # ============================================
  app:
    build: .
    image: sixty-sales:latest
    container_name: app-${CUSTOMER_ID}

    ports:
      # Each customer gets a unique port
      # Port mapping: 3000 + customer_number
      - "${CUSTOMER_PORT}:3000"

    environment:
      # Application
      - NODE_ENV=production
      - PORT=3000
      - CUSTOMER_ID=${CUSTOMER_ID}
      - CUSTOMER_NAME=${CUSTOMER_NAME}

      # Database
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db-${CUSTOMER_ID}:5432/${DB_NAME}
      - DATABASE_POOL_MIN=2
      - DATABASE_POOL_MAX=10

      # Redis (for job queue)
      - REDIS_URL=redis://redis-${CUSTOMER_ID}:6379/0

      # JWT & Security
      - JWT_SECRET=${JWT_SECRET}
      - API_KEY_PREFIX=${CUSTOMER_ID}

      # Logging
      - LOG_LEVEL=info
      - LOG_FORMAT=json

    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

    networks:
      - customer-${CUSTOMER_ID}

    restart: unless-stopped

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

    volumes:
      # Logs volume (for persistence)
      - logs-${CUSTOMER_ID}:/app/logs

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ============================================
  # PostgreSQL Database Container
  # ============================================
  db:
    image: postgres:15-alpine
    container_name: db-${CUSTOMER_ID}

    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_INITDB_ARGS=--encoding=UTF8

    volumes:
      # Data persistence
      - postgres-data-${CUSTOMER_ID}:/var/lib/postgresql/data

      # Initialization scripts
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./scripts/migrations.sql:/docker-entrypoint-initdb.d/02-migrations.sql

    networks:
      - customer-${CUSTOMER_ID}

    restart: unless-stopped

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ============================================
  # Redis Cache & Job Queue Container
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: redis-${CUSTOMER_ID}

    command: redis-server --requirepass ${REDIS_PASSWORD}

    volumes:
      # Data persistence
      - redis-data-${CUSTOMER_ID}:/data

    networks:
      - customer-${CUSTOMER_ID}

    restart: unless-stopped

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# ============================================
# Networks (Isolated per customer)
# ============================================
networks:
  customer-${CUSTOMER_ID}:
    driver: bridge

# ============================================
# Volumes (Persistent storage per customer)
# ============================================
volumes:
  postgres-data-${CUSTOMER_ID}:
  redis-data-${CUSTOMER_ID}:
  logs-${CUSTOMER_ID}:
```

---

## STEP 3: Tenant Provisioning Script

**File: `scripts/provision-customer.sh`**

This script creates a new customer environment:

```bash
#!/bin/bash

# Provision new customer with Docker containers
# Usage: ./scripts/provision-customer.sh --id acme --name "ACME Corp"

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
CUSTOMER_ID=""
CUSTOMER_NAME=""
CUSTOMER_PORT=""
DB_USER=""
DB_PASSWORD=""
REDIS_PASSWORD=""
JWT_SECRET=""

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
      CUSTOMER_PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate inputs
if [ -z "$CUSTOMER_ID" ] || [ -z "$CUSTOMER_NAME" ]; then
  echo -e "${RED}Error: --id and --name are required${NC}"
  echo "Usage: ./scripts/provision-customer.sh --id <id> --name <name> [--port <port>]"
  exit 1
fi

# Generate default port if not provided
if [ -z "$CUSTOMER_PORT" ]; then
  # Find next available port (3001 onwards)
  CUSTOMER_PORT=3001
  while lsof -Pi :$CUSTOMER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    CUSTOMER_PORT=$((CUSTOMER_PORT + 1))
  done
fi

# Generate secure passwords if not provided
DB_USER="user_${CUSTOMER_ID}"
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

echo -e "${YELLOW}Provisioning new customer...${NC}"
echo "Customer ID: $CUSTOMER_ID"
echo "Customer Name: $CUSTOMER_NAME"
echo "Port: $CUSTOMER_PORT"

# Create customer directory
CUSTOMER_DIR="customers/${CUSTOMER_ID}"
mkdir -p "$CUSTOMER_DIR"

# Create .env file for this customer
cat > "$CUSTOMER_DIR/.env" << EOF
# Customer Configuration
CUSTOMER_ID=${CUSTOMER_ID}
CUSTOMER_NAME=${CUSTOMER_NAME}
CUSTOMER_PORT=${CUSTOMER_PORT}

# Database
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=sales_${CUSTOMER_ID}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}

# Application
NODE_ENV=production
LOG_LEVEL=info
EOF

# Create docker-compose file for this customer
cat > "$CUSTOMER_DIR/docker-compose.yml" << 'COMPOSE_EOF'
version: '3.8'

services:
  app:
    build: ../../.
    image: sixty-sales:latest
    container_name: app-${CUSTOMER_ID}
    ports:
      - "${CUSTOMER_PORT}:3000"
    environment:
      - NODE_ENV=${NODE_ENV}
      - CUSTOMER_ID=${CUSTOMER_ID}
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db-${CUSTOMER_ID}:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis-${CUSTOMER_ID}:6379/0
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - customer-${CUSTOMER_ID}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  db:
    image: postgres:15-alpine
    container_name: db-${CUSTOMER_ID}
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres-data-${CUSTOMER_ID}:/var/lib/postgresql/data
      - ../../scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    networks:
      - customer-${CUSTOMER_ID}
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: redis-${CUSTOMER_ID}
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data-${CUSTOMER_ID}:/data
    networks:
      - customer-${CUSTOMER_ID}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  customer-${CUSTOMER_ID}:
    driver: bridge

volumes:
  postgres-data-${CUSTOMER_ID}:
  redis-data-${CUSTOMER_ID}:
COMPOSE_EOF

echo -e "${GREEN}✓ Created customer directory: $CUSTOMER_DIR${NC}"

# Store credentials securely (in a real system, use a secrets manager)
mkdir -p secrets
cat > "secrets/${CUSTOMER_ID}.env" << EOF
# KEEP THIS SECURE - Store in production secrets manager
CUSTOMER_ID=${CUSTOMER_ID}
CUSTOMER_PORT=${CUSTOMER_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF

chmod 600 "secrets/${CUSTOMER_ID}.env"

echo -e "${GREEN}✓ Created .env file${NC}"

# Start containers
echo -e "${YELLOW}Starting containers...${NC}"

cd "$CUSTOMER_DIR"
docker-compose up -d

# Wait for database to be ready
echo -e "${YELLOW}Waiting for database to be ready...${NC}"
sleep 10

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker-compose exec -T db psql -U "${DB_USER}" -d "${DB_NAME}" \
  -f /docker-entrypoint-initdb.d/02-migrations.sql

cd - > /dev/null

echo ""
echo -e "${GREEN}✓ Customer provisioned successfully!${NC}"
echo ""
echo -e "Customer Details:"
echo "  ID: ${CUSTOMER_ID}"
echo "  Name: ${CUSTOMER_NAME}"
echo "  Port: ${CUSTOMER_PORT}"
echo "  URL: http://localhost:${CUSTOMER_PORT}"
echo ""
echo -e "Database:"
echo "  Host: localhost"
echo "  Container: db-${CUSTOMER_ID}"
echo "  User: ${DB_USER}"
echo ""
echo -e "Next steps:"
echo "  1. Verify app is running: curl http://localhost:${CUSTOMER_PORT}/health"
echo "  2. View logs: cd $CUSTOMER_DIR && docker-compose logs -f app"
echo "  3. Stop containers: cd $CUSTOMER_DIR && docker-compose down"
echo ""
echo -e "${YELLOW}Credentials stored in: secrets/${CUSTOMER_ID}.env${NC}"
echo -e "${YELLOW}Move this to production secrets manager!${NC}"
```

**Usage:**
```bash
# Provision new customer
./scripts/provision-customer.sh --id acme --name "ACME Corp"

# Output:
# ✓ Created customer directory: customers/acme
# ✓ Created .env file
# ✓ Customer provisioned successfully!
#
# Customer Details:
#   ID: acme
#   Name: ACME Corp
#   Port: 3001
#   URL: http://localhost:3001
```

---

## STEP 4: Database Initialization Script

**File: `scripts/init-db.sql`**

Initialize PostgreSQL with proper schema and RLS:

```sql
-- ============================================
-- Customer Database Initialization
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema for user management
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================
-- Create Base Tables
-- ============================================

-- Users/Profiles
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations (Tenant)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Org Members
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, readonly
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, user_id)
);

-- CRM Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  value DECIMAL(12, 2),
  stage VARCHAR(50) DEFAULT 'sql', -- sql, opportunity, verbal, signed
  contact_id UUID REFERENCES public.contacts(id),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type VARCHAR(50), -- call, email, meeting, proposal, note
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Organization Policies
-- ============================================

CREATE POLICY "Users can view their orgs"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

-- ============================================
-- Contacts Policies
-- ============================================

CREATE POLICY "Users can view org contacts"
  ON public.contacts FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

CREATE POLICY "Users can create org contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

-- ============================================
-- Deals Policies
-- ============================================

CREATE POLICY "Users can view org deals"
  ON public.deals FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

CREATE POLICY "Users can create org deals"
  ON public.deals FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

-- ============================================
-- Activities Policies
-- ============================================

CREATE POLICY "Users can view org activities"
  ON public.activities FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_memberships
      WHERE user_id = CURRENT_USER_ID()
    )
  );

-- ============================================
-- Create Indexes for Performance
-- ============================================

CREATE INDEX idx_contacts_org_id ON public.contacts(org_id);
CREATE INDEX idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX idx_deals_org_id ON public.deals(org_id);
CREATE INDEX idx_deals_owner_id ON public.deals(owner_id);
CREATE INDEX idx_activities_org_id ON public.activities(org_id);
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_org_memberships_org_id ON public.organization_memberships(org_id);
CREATE INDEX idx_org_memberships_user_id ON public.organization_memberships(user_id);

-- ============================================
-- Helper Function for Current User
-- ============================================

CREATE OR REPLACE FUNCTION CURRENT_USER_ID() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Done
-- ============================================

\echo 'Customer database initialized successfully!'
```

---

## STEP 5: Docker Compose for Local Development

**File: `docker-compose.local.yml`**

For local testing with single customer:

```yaml
version: '3.8'

services:
  # Frontend dev server (Vite)
  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    command: npm run dev

  # Backend API server
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/sixty_sales_local
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=dev-secret-key
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./src:/app/src
    command: npm run dev

  # PostgreSQL
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=sixty_sales_local
    ports:
      - "5432:5432"
    volumes:
      - postgres_local_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_local_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_local_data:
  redis_local_data:
```

**Usage for local development:**
```bash
# Start all services
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f backend

# Stop all
docker-compose -f docker-compose.local.yml down
```

---

## STEP 6: Nginx Reverse Proxy (Multi-Customer Routing)

**File: `config/nginx-multi-tenant.conf`**

Route incoming requests to correct customer container:

```nginx
# ============================================
# Nginx Multi-Tenant Reverse Proxy
# ============================================

upstream customers {
  # Dynamically resolved upstream for customer containers
  # Pattern: http://app-{customer_id}:3000
}

server {
  listen 80;
  server_name _;

  # Extract customer ID from subdomain or path
  # Example: customer1.example.com → route to app-customer1:3000
  # Example: example.com/customer1 → route to app-customer1:3000

  location / {
    # Extract customer ID from host header
    set $customer_id $host;

    # If subdomain pattern (customer1.example.com)
    if ($host ~* ^([a-z0-9-]+)\.example\.com$) {
      set $customer_id $1;
    }

    # If path pattern (/customer1/...)
    if ($uri ~* ^/([a-z0-9-]+)/?$) {
      set $customer_id $1;
      rewrite ^/([a-z0-9-]+)/(.*)$ /$2 break;
    }

    # Route to customer container
    proxy_pass http://app-$customer_id:3000;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Health check endpoint (no routing)
  location /health {
    return 200 "OK";
    access_log off;
  }
}
```

---

## IMPLEMENTATION CHECKLIST

### Week 1: Core Docker Setup
- [ ] Create Dockerfile with multi-stage build
- [ ] Create docker-compose.customer.yml template
- [ ] Create docker-compose.local.yml for development
- [ ] Test Docker build locally
- [ ] Test local docker-compose up

### Week 2: Provisioning System
- [ ] Create provision-customer.sh script
- [ ] Create init-db.sql with RLS
- [ ] Test provisioning script
- [ ] Verify database isolation per customer
- [ ] Create documentation

### Week 3: API Integration
- [ ] Create Express backend skeleton
- [ ] Implement middleware stack
- [ ] Convert API CRUD endpoints
- [ ] Add customer context middleware
- [ ] Test endpoints per customer

### Week 4: Multi-Tenant Routing
- [ ] Set up Nginx reverse proxy
- [ ] Implement customer subdomain routing
- [ ] Implement customer path routing
- [ ] Test routing to multiple customer containers
- [ ] Load balancing testing

---

## QUICK START: Provision Your First Customer

```bash
# 1. Build Docker image
docker build -t sixty-sales:latest .

# 2. Provision customer
./scripts/provision-customer.sh --id acme --name "ACME Corp"

# 3. Verify running
docker ps | grep acme

# 4. Check health
curl http://localhost:3001/health

# 5. View logs
docker logs app-acme
```

---

## SECURITY CONSIDERATIONS

1. **Network Isolation:** Each customer in separate Docker network
2. **Database Isolation:** RLS policies + org_id filtering
3. **Secrets Management:** Store in production secrets manager (AWS Secrets Manager, Vault)
4. **Resource Limits:** Set CPU/memory limits per container
5. **Monitoring:** Track resource usage per customer
6. **Backups:** Per-customer automated backups

---

## SCALING STRATEGY

**Vertical Scaling (Single Host):**
- Run 10-20 customers per server
- Monitor resource usage
- Add more servers when needed

**Horizontal Scaling (Multiple Hosts):**
- Use Docker Swarm or Kubernetes
- Distribute customer containers across hosts
- Central PostgreSQL or per-host databases

---

This architecture enables **one-click customer onboarding** with complete isolation.

