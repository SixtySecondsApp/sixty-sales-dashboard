# SaaS Multi-Tenant Infrastructure Setup

**Status:** ✅ **PHASE 1 COMPLETE - Database & Infrastructure Foundation**

**Date:** November 26, 2025

---

## Overview

This document covers the foundational infrastructure setup for the Sixty Sales Dashboard SaaS platform. The architecture now supports multiple isolated customer databases managed through a central Admin Control Plane.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SaaS CONTROL PLANE                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Admin Database (port 5433)                                          │  │
│  │  - Customer metadata & organizations                                 │  │
│  │  - Feature modules & enablement per customer                         │  │
│  │  - API keys & usage limits                                           │  │
│  │  - AI key ownership & token tracking                                 │  │
│  │  - Subscriptions & billing                                           │  │
│  │  - Audit logs & compliance                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │  Customer DB 1   │ │  Customer DB 2   │ │  Customer DB N   │
        │  (port: 5434+)   │ │  (port: 5435+)   │ │  (port: 5436+)   │
        ├──────────────────┤ ├──────────────────┤ ├──────────────────┤
        │ - organizations  │ │ - organizations  │ │ - organizations  │
        │ - contacts       │ │ - contacts       │ │ - contacts       │
        │ - deals          │ │ - deals          │ │ - deals          │
        │ - activities     │ │ - activities     │ │ - activities     │
        │ - tasks          │ │ - tasks          │ │ - tasks          │
        │ - workflows      │ │ - workflows      │ │ - workflows      │
        │ - RLS enforced   │ │ - RLS enforced   │ │ - RLS enforced   │
        └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Services Running Locally

All services are containerized with Docker Compose for local development:

### 1. Admin Database (Port 5433)
```bash
Container:   saas-admin-db-dev
Image:       postgres:16-alpine
Database:    saas_admin
User:        admin_user
Password:    admin_password
Volume:      postgres-admin-data-dev (persistent)
Status:      ✅ Running & Healthy
```

**Connection String:**
```
postgresql://admin_user:admin_password@localhost:5433/saas_admin
```

**JDBC URL (for DBWeaver):**
```
jdbc:postgresql://localhost:5433/saas_admin
```

### 2. Customer Database - Development Template (Port 5432)
```bash
Container:   saas-db-dev
Image:       postgres:16-alpine
Database:    saas_dev
User:        dev_user
Password:    dev_password
Volume:      postgres-data-dev (persistent)
Status:      ✅ Running & Healthy
```

**Connection String:**
```
postgresql://dev_user:dev_password@localhost:5432/saas_dev
```

### 3. Redis Cache & Job Queue (Port 6379)
```bash
Container:   saas-redis-dev
Image:       redis:7-alpine
Password:    dev_password
Volume:      redis-data-dev (persistent)
Status:      ✅ Running & Healthy
```

**Connection String:**
```
redis://:dev_password@localhost:6379
```

### 4. Express Application Server (Port 3000)
```bash
Container:   saas-app-dev
Image:       sixty-sales-dashboard:latest
Status:      ✅ Running (health check: /api/health)
Frontend:    Served on http://localhost:3000
API:         Available at http://localhost:3000/api/*
```

### 5. Bull Job Queue Worker
```bash
Container:   saas-worker-dev
Image:       sixty-sales-dashboard:latest
Status:      ✅ Running (background processing)
Purpose:     Async job processing, long-running tasks
```

---

## Admin Database Schema

### Tables Created (9 total)

| Table | Purpose | Rows |
|-------|---------|------|
| `admin_customers` | Main tenant records with DB credentials | 0 |
| `admin_feature_modules` | Feature definitions & pricing | 10 |
| `admin_customer_modules` | Feature enablement per customer | 0 |
| `admin_api_keys` | API key management & hashing | 0 |
| `admin_api_usage` | API request tracking | 0 |
| `admin_customer_ai_keys` | Customer's own encrypted AI keys | 0 |
| `admin_ai_key_usage` | Token consumption tracking | 0 |
| `admin_audit_logs` | Complete action history | 0 |
| `admin_subscription_invoices` | Billing records | 0 |

### Feature Modules (Pre-seeded)

| Module | Price | Default | Notes |
|--------|-------|---------|-------|
| CRM Core | $0/mo | ✅ | Always enabled, included base |
| Advanced Pipeline | $29.99/mo | ✅ | Custom stages, automation |
| Calendar Integration | $19.99/mo | ❌ | Google Calendar sync |
| AI Assistant | $49.99/mo | ❌ | AI-powered insights |
| Workflow Automation | $39.99/mo | ❌ | Custom workflows |
| Analytics & Reporting | $59.99/mo | ❌ | Advanced dashboards |
| API Access | $79.99/mo | ❌ | REST API integration |
| Custom Fields | $19.99/mo | ❌ | Custom data fields |
| Bulk Operations | $29.99/mo | ❌ | Bulk import/export |
| Compliance & Audit | $99.99/mo | ❌ | Audit logs, compliance |

---

## Database Connection Pooling

### Admin Database Pool Configuration

```typescript
// src/lib/adminDb.ts
const pool = new Pool({
  host: ADMIN_DB_HOST,
  port: parseInt(ADMIN_DB_PORT, 10),
  user: ADMIN_DB_USER,
  password: ADMIN_DB_PASSWORD,
  database: ADMIN_DB_NAME,
  max: 20,                      // Maximum connections
  idleTimeoutMillis: 30000,     // 30s idle timeout
  connectionTimeoutMillis: 2000 // 2s connection timeout
});
```

**Key Functions:**
- `initializeAdminDb()` - Initialize pool on startup
- `getAdminPool()` - Get current pool instance
- `closeAdminDb()` - Close pool on shutdown

---

## Backend Utilities

### Admin Database Module (`src/lib/adminDb.ts`)

Provides TypeScript utilities for backend interactions with Admin DB:

#### Customer Queries
```typescript
getCustomerById(customerId: string): Promise<AdminCustomer>
getCustomerByClerkOrgId(clerkOrgId: string): Promise<AdminCustomer>
getCustomerByDomain(domain: string): Promise<AdminCustomer>
getActiveCustomers(limit, offset): Promise<{customers, total}>
```

#### Feature Module Queries
```typescript
getAllFeatureModules(): Promise<FeatureModule[]>
isModuleEnabledForCustomer(customerId, moduleKey): Promise<boolean>
getCustomerEnabledModules(customerId): Promise<CustomerModuleStatus[]>
```

#### API Key Queries
```typescript
getCustomerApiKeys(customerId): Promise<ApiKey[]>
validateApiKeyHash(keyHash): Promise<ApiKey | null>
```

#### Usage Tracking
```typescript
logApiUsage(apiKeyId, customerId, endpoint, method, statusCode, responseTime)
logAiTokenUsage(customerId, provider, keyOwner, promptTokens, completionTokens, cost)
getAiUsageSummary(customerId): Promise<UsageSummary>
```

#### Audit Logging
```typescript
logAuditAction(customerId, action, resourceType, resourceId, oldValues, newValues, ...)
```

---

## Docker Compose Configuration

### Local Development (`docker-compose.local.yml`)

All services configured with:
- Health checks for automatic restart
- Volume persistence for data
- Environment variable management
- Service dependencies (proper startup order)
- Isolated Docker network (saas-local)

**Key Updates:**
- Added `admin-db` service with separate port (5433)
- Updated `app` & `worker` with Admin DB environment variables
- Added `postgres-admin-data-dev` volume
- Services depend on `admin-db` health check

---

## File Inventory

### New Files Created

| File | Purpose | Size |
|------|---------|------|
| `scripts/init-admin-db.sql` | Complete Admin DB schema initialization | 650+ lines |
| `src/lib/adminDb.ts` | TypeScript utilities for Admin DB queries | 400+ lines |
| `ADMIN_DB_SETUP.md` | Comprehensive connection & schema guide | 400+ lines |
| `INFRASTRUCTURE_SETUP.md` | This file - infrastructure overview | 300+ lines |

### Modified Files

| File | Changes |
|------|---------|
| `docker-compose.local.yml` | Added admin-db service, updated app/worker configs |

---

## Quick Start Commands

### Start All Services

```bash
# First time setup
./scripts/local-setup.sh

# Or manually
docker compose -f docker-compose.local.yml up -d

# Verify all services running
docker compose -f docker-compose.local.yml ps
```

### Database Access

```bash
# Admin database
psql -h localhost -p 5433 -U admin_user -d saas_admin
docker compose -f docker-compose.local.yml exec admin-db psql -U admin_user -d saas_admin

# Customer database (dev)
psql -h localhost -p 5432 -U dev_user -d saas_dev
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev

# View logs
docker compose -f docker-compose.local.yml logs -f admin-db
docker compose -f docker-compose.local.yml logs -f db
```

### DBWeaver Connection

**Admin Database:**
- JDBC URL: `jdbc:postgresql://localhost:5433/saas_admin`
- Username: `admin_user`
- Password: `admin_password`

**Customer Database:**
- JDBC URL: `jdbc:postgresql://localhost:5432/saas_dev`
- Username: `dev_user`
- Password: `dev_password`

---

## Data Persistence

### Volumes

All data persists between Docker restarts:

```bash
# List volumes
docker volume ls | grep postgres

# Inspect volume
docker volume inspect sixty-sales-dashboard_postgres-admin-data-dev

# Clear volumes (fresh start)
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d
```

### Database Backup

```bash
# Backup Admin DB
docker compose -f docker-compose.local.yml exec admin-db \
  pg_dump -U admin_user saas_admin > backup-admin.sql

# Backup Customer DB
docker compose -f docker-compose.local.yml exec db \
  pg_dump -U dev_user saas_dev > backup-customer.sql

# Restore Admin DB
docker compose -f docker-compose.local.yml exec admin-db \
  psql -U admin_user saas_admin < backup-admin.sql
```

---

## Environment Variables

### Admin Database Configuration

```bash
ADMIN_DB_HOST=admin-db              # Docker service name
ADMIN_DB_PORT=5432                  # Internal port (mapped to 5433)
ADMIN_DB_USER=admin_user
ADMIN_DB_PASSWORD=admin_password
ADMIN_DB_NAME=saas_admin
```

### Customer Database Configuration

```bash
DB_HOST=db                          # Docker service name
DB_PORT=5432
DB_USER=dev_user
DB_PASSWORD=dev_password
DB_NAME=saas_dev
DATABASE_URL=postgresql://dev_user:dev_password@db:5432/saas_dev
```

### Redis Configuration

```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=dev_password
REDIS_URL=redis://:dev_password@redis:6379
```

---

## Next Phase: Customer Provisioning

With the foundational infrastructure now in place, the next phase will implement:

### ✅ Completed
1. Admin database schema with all control plane tables
2. Customer database template with RLS policies
3. Docker Compose setup with both databases
4. Connection pooling & utilities
5. Feature module definitions & pricing
6. Audit logging infrastructure

### ⏳ Next Steps
1. **Customer Provisioning Script** - `provision-customer-v2.sh`
   - Create new PostgreSQL instance per customer
   - Generate unique credentials (encrypted storage)
   - Initialize customer database schema
   - Create initial API keys
   - Register in admin_customers table

2. **Clerk Integration**
   - Link Clerk organizations to admin_customers
   - Sync user roles & permissions
   - Authentication middleware

3. **API Integration**
   - Usage tracking middleware
   - Rate limiting enforcement
   - Module access control middleware

4. **Admin Dashboard**
   - Customer management UI
   - Usage analytics & reporting
   - API key management interface
   - Subscription & billing management

---

## Security Considerations

### Development (Current)
- Plain text passwords in environment variables
- No encryption for sensitive fields
- All credentials visible in docker-compose

### Production (TODO)
- Use AWS Secrets Manager or HashiCorp Vault
- Encrypt `database_password_encrypted` field with pgcrypto
- Encrypt `api_key_encrypted` fields
- Rotate credentials regularly
- Use SSL/TLS for all database connections
- Implement database user with minimal required permissions
- Regular security audits and penetration testing

---

## Troubleshooting

### Admin DB Won't Connect

```bash
# Check container is running
docker compose -f docker-compose.local.yml ps admin-db

# View logs
docker compose -f docker-compose.local.yml logs admin-db

# Test connection inside container
docker compose -f docker-compose.local.yml exec admin-db pg_isready -U admin_user -d saas_admin
```

### Schema Not Initialized

```bash
# Verify tables exist
docker compose -f docker-compose.local.yml exec admin-db psql -U admin_user -d saas_admin -c "\dt"

# Manually run init script
docker compose -f docker-compose.local.yml exec admin-db \
  psql -U admin_user -d saas_admin -f /docker-entrypoint-initdb.d/01-admin-init.sql
```

### Port Conflicts

```bash
# Check what's using port 5433
lsof -i :5433

# Kill if needed
kill -9 <PID>

# Or change port in docker-compose.local.yml and restart
```

---

## References

### Documentation
- **ADMIN_DB_SETUP.md** - Detailed schema & connection guide
- **LOCAL_DEVELOPMENT_SETUP.md** - Dev environment instructions
- **DOCKER_MULTI_TENANT_ARCHITECTURE.md** - Architecture deep dive

### Code Files
- **scripts/init-admin-db.sql** - Admin DB schema initialization
- **src/lib/adminDb.ts** - Backend utilities & connection pooling
- **docker-compose.local.yml** - Docker services configuration
- **Dockerfile.multitenant.simple** - Container image definition

---

## Metrics

### Schema Statistics
- **9 Tables** - Complete control plane schema
- **30+ Indexes** - Performance optimization
- **10 Feature Modules** - Pre-seeded with pricing
- **3 Database Views** - Common query patterns

### Container Statistics
- **5 Services** - Admin DB, Customer DB, Redis, App, Worker
- **2 PostgreSQL instances** - Separate control plane & customer
- **1 Redis instance** - Caching & job queue
- **2 Application containers** - Server & worker

---

**Last Updated:** November 26, 2025
**Status:** ✅ Phase 1 Complete
**Next Review:** Before customer provisioning implementation

