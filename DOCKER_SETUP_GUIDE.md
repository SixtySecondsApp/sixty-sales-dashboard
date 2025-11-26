# Docker Multi-Tenant Setup Guide

Complete guide for building and deploying the Sixty Sales Dashboard as a multi-tenant SaaS application using Docker.

## Overview

This setup enables:
- **Complete customer isolation** - Each customer gets their own PostgreSQL database
- **Per-customer containerization** - Each customer's environment is independent
- **Automatic provisioning** - One-command customer deployment
- **Scalable infrastructure** - Deploy unlimited customer instances
- **Row-Level Security** - Database-level data isolation
- **Job Queue Integration** - Bull queue for async task processing

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx Reverse Proxy                       │
│         (Routes subdomain/path to customer containers)           │
└─────────────────────────────────────────────────────────────────┘
                ↓                                    ↓
    ┌──────────────────────┐          ┌──────────────────────┐
    │   Customer-A Stack   │          │   Customer-B Stack   │
    │                      │          │                      │
    │  ┌────────────────┐  │          │  ┌────────────────┐  │
    │  │ App Container  │  │          │  │ App Container  │  │
    │  │   (Express)    │  │          │  │   (Express)    │  │
    │  └────────────────┘  │          │  └────────────────┘  │
    │         ↓                           ↓                   │
    │  ┌────────────────┐  │          │  ┌────────────────┐  │
    │  │ PostgreSQL DB  │  │          │  │ PostgreSQL DB  │  │
    │  │   (Isolated)   │  │          │  │   (Isolated)   │  │
    │  └────────────────┘  │          │  └────────────────┘  │
    │         ↓                           ↓                   │
    │  ┌────────────────┐  │          │  ┌────────────────┐  │
    │  │    Redis       │  │          │  │    Redis       │  │
    │  │  (Job Queue)   │  │          │  │  (Job Queue)   │  │
    │  └────────────────┘  │          │  └────────────────┘  │
    │         ↓                           ↓                   │
    │  ┌────────────────┐  │          │  ┌────────────────┐  │
    │  │ Worker Process │  │          │  │ Worker Process │  │
    │  │  (Bull Queue)  │  │          │  │  (Bull Queue)  │  │
    │  └────────────────┘  │          │  └────────────────┘  │
    └──────────────────────┘          └──────────────────────┘
        network-customer-a              network-customer-b
```

## Prerequisites

### System Requirements
- Docker 24.0+ (with Docker Compose v2.20+)
- 8GB+ RAM (recommended 16GB for multiple customers)
- 20GB+ available disk space
- Linux or macOS (Windows requires WSL2)

### Software Requirements
```bash
# Verify Docker installation
docker --version
docker-compose --version

# Expected output:
# Docker version 24.0+
# Docker Compose version v2.20.0+
```

## Phase 1: Build Docker Image

### Step 1: Build Multitenant Docker Image

```bash
cd /path/to/project

# Build the multitenant Docker image
docker build -f Dockerfile.multitenant \
  -t sixty-sales-dashboard:multitenant \
  -t sixty-sales-dashboard:latest \
  .
```

**Build time:** ~3-5 minutes (depends on network and CPU)

**Expected output:**
```
[stage 1/3] FROM node:20-alpine
...
[stage 3/3] USER nodejs
Successfully tagged sixty-sales-dashboard:multitenant
Successfully tagged sixty-sales-dashboard:latest
```

### Step 2: Verify Image Size

```bash
docker images | grep sixty-sales-dashboard
```

**Expected size:** 300-400MB for production image

### What the Build Does

**Frontend Stage (Vite):**
1. Compiles React/TypeScript application with Vite
2. Optimizes bundle with tree-shaking and minification
3. Generates static HTML, CSS, JavaScript files

**Backend Stage (Node.js):**
1. Installs production dependencies only
2. Removes development dependencies
3. Optimizes package size

**Final Stage:**
1. Copies built frontend to `/app/frontend/dist`
2. Copies production dependencies
3. Creates non-root user for security
4. Configures health checks
5. Sets up graceful shutdown handling

## Phase 2: Provision First Customer

### Step 1: Make Provisioning Script Executable

```bash
chmod +x scripts/provision-customer.sh
```

### Step 2: Provision a Test Customer

```bash
./scripts/provision-customer.sh \
  --id acme-corp \
  --name "ACME Corporation"
```

**Expected duration:** 1-2 minutes

**Output includes:**
```
========================================
Customer Provisioned Successfully!
========================================

Customer Information:
  ID:                     acme-corp
  Name:                   ACME Corporation
  Directory:              ./customers/acme-corp

Port Configuration:
  Application:            localhost:3001
  Database:               localhost:5433
  Redis:                  localhost:6380

Database Credentials:
  User:                   customer_acme_corp
  Database:               saas_acme_corp
  Password:               [See .env file]

Useful Commands:
  View logs:              cd customers/acme-corp && docker-compose logs -f
  Stop containers:        cd customers/acme-corp && docker-compose down
  Restart containers:     cd customers/acme-corp && docker-compose up -d
  Check status:           cd customers/acme-corp && docker-compose ps
  SSH to database:        psql -h localhost -p 5433 -U customer_acme_corp -d saas_acme_corp
```

### What the Provisioning Script Does

1. **Validates inputs** - Customer ID and name validation
2. **Creates directory structure** - `customers/acme-corp/` with subdirectories
3. **Generates credentials** - Secure random passwords, JWT secrets, keys
4. **Creates .env file** - Customer-specific environment variables
5. **Generates docker-compose.yml** - From template with variable substitution
6. **Builds/uses Docker image** - Uses pre-built multitenant image
7. **Starts containers**:
   - PostgreSQL database
   - Redis cache/queue
   - Express application
   - Bull worker process
8. **Runs migrations** - Initializes database schema and RLS policies
9. **Verifies health** - Ensures all services are running
10. **Outputs manifest** - Customer information and quick reference

## Phase 3: Verify Customer Deployment

### Step 1: Check Container Status

```bash
cd customers/acme-corp
docker-compose ps
```

**Expected output:**
```
NAME                   STATUS          PORTS
app-acme-corp         Up 2 minutes     0.0.0.0:3001->3000/tcp
db-acme-corp          Up 2 minutes     0.0.0.0:5433->5432/tcp
redis-acme-corp       Up 2 minutes     0.0.0.0:6380->6379/tcp
worker-acme-corp      Up 2 minutes
```

### Step 2: Test Application Health

```bash
curl http://localhost:3001/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T10:30:45.123Z",
  "customer": "acme-corp",
  "environment": "production",
  "uptime": 45.234
}
```

### Step 3: Test Database Connection

```bash
# From project root
psql -h localhost -p 5433 -U customer_acme_corp -d saas_acme_corp -c "SELECT * FROM organizations LIMIT 1;"
```

**Expected response:**
```
                  id                  |          name          |     slug      | description | logo_url |         created_at          |         updated_at
--------------------------------------+------------------------+---------------+-------------+----------+-----------------------------+-----------------------------
 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | Default Organization | customer-default | ...      | (null)   | 2025-11-26 10:30:45.123456+00 | 2025-11-26 10:30:45.123456+00
(1 row)
```

### Step 4: View Logs

```bash
cd customers/acme-corp

# All services
docker-compose logs

# Specific service
docker-compose logs app-acme-corp
docker-compose logs db-acme-corp
docker-compose logs redis-acme-corp
docker-compose logs worker-acme-corp

# Follow logs in real-time
docker-compose logs -f
```

## Phase 4: Deploy Additional Customers

### Provision Second Customer

```bash
./scripts/provision-customer.sh \
  --id techstart \
  --name "TechStart Inc"
```

**Note:** Ports are automatically assigned:
- Customer 1 (acme-corp): App 3001, DB 5433, Redis 6380
- Customer 2 (techstart): App 3002, DB 5434, Redis 6381
- etc.

### Provision with Custom Port

```bash
./scripts/provision-customer.sh \
  --id enterprise \
  --name "Enterprise Ltd" \
  --port 3005
```

This will use:
- App: 3005
- DB: 5438 (5433 + 5)
- Redis: 6385 (6380 + 5)

## Production Deployment Checklist

### Pre-Deployment

- [ ] Test Docker build locally
- [ ] Provision test customer and verify all services
- [ ] Test database connectivity and RLS policies
- [ ] Review and secure all credentials in `.env` files
- [ ] Set up secret management (AWS Secrets Manager, Vault)
- [ ] Configure Nginx reverse proxy for subdomain routing
- [ ] Set up monitoring and alerting

### Infrastructure

- [ ] Deploy to production server (AWS EC2, DigitalOcean, Railway)
- [ ] Configure Docker persistent volumes for data durability
- [ ] Set up automated backups for PostgreSQL databases
- [ ] Configure Docker network for security isolation
- [ ] Enable Docker logging to centralized service
- [ ] Set up SSL/TLS certificates for HTTPS

### Monitoring

- [ ] Set up container health monitoring
- [ ] Configure database monitoring (slow query logs, replication)
- [ ] Set up application performance monitoring (APM)
- [ ] Configure alerting for resource limits
- [ ] Set up log aggregation (ELK, Loki, Datadog)

### Security

- [ ] Rotate all credentials before go-live
- [ ] Enable Docker security scanning
- [ ] Configure firewall rules
- [ ] Set up DDoS protection
- [ ] Enable database encryption at rest
- [ ] Configure rate limiting on API endpoints

## Troubleshooting

### Issue: Containers Won't Start

```bash
cd customers/acme-corp
docker-compose logs

# Common causes:
# 1. Port already in use
# 2. Insufficient disk space
# 3. Docker daemon not running
```

### Issue: Database Connection Refused

```bash
# Check if database is ready
docker-compose exec db-acme-corp pg_isready

# Check database password
cat .env | grep DB_PASSWORD

# Test connection directly
psql -h localhost -p 5433 -U customer_acme_corp -d saas_acme_corp -c "SELECT 1"
```

### Issue: Application Returning 503

```bash
# Check if dependencies are initialized
docker-compose logs app-acme-corp

# Check database and Redis connectivity
docker-compose exec app-acme-corp curl -v http://db-acme-corp:5432/
docker-compose exec app-acme-corp redis-cli -h redis-acme-corp ping
```

### Issue: High Memory Usage

```bash
# Check per-container memory usage
docker stats

# Reduce resource limits in docker-compose.yml
# Current limits: App 2GB, DB 512MB, Redis 256MB
```

## Scaling Considerations

### Horizontal Scaling (Multiple Customers)

Each customer gets isolated containers and database. To add customers:

```bash
# For 10 customers
for i in {1..10}; do
  ./scripts/provision-customer.sh \
    --id "customer-$i" \
    --name "Customer $i"
done
```

### Vertical Scaling (Single Customer)

Increase resources in `docker-compose.yml`:

```yaml
app-${CUSTOMER_ID}:
  deploy:
    resources:
      limits:
        cpus: '4'      # Increase from 2
        memory: 2G     # Increase from 1G
```

### Database Scaling

For large customers, consider:
- Dedicated RDS instance instead of Docker container
- Read replicas for reporting queries
- Connection pooling (PgBouncer)
- Partitioning large tables

## Next Steps

1. **API Implementation** (Phase 5-6)
   - Convert Supabase Edge Functions to Express routes
   - Implement database service layer
   - Add authentication middleware

2. **Billing & Onboarding** (Phase 6-7)
   - Stripe integration for subscriptions
   - Customer dashboard
   - Usage metering and billing

3. **Monitoring & Observability** (Phase 8)
   - Distributed tracing (Jaeger)
   - Log aggregation (Loki)
   - Metrics collection (Prometheus)
   - Error tracking (Sentry)

4. **High Availability** (Phase 9-10)
   - Database replication
   - Container orchestration (Kubernetes)
   - Load balancing
   - Disaster recovery

## Reference

- [Dockerfile.multitenant](./Dockerfile.multitenant) - Multi-stage Docker build
- [docker-compose.customer.template.yml](./docker-compose.customer.template.yml) - Customer compose template
- [scripts/provision-customer.sh](./scripts/provision-customer.sh) - Provisioning script
- [scripts/init-db.sql](./scripts/init-db.sql) - Database initialization with RLS
- [server.js](./server.js) - Express backend server
- [DOCKER_MULTI_TENANT_ARCHITECTURE.md](./DOCKER_MULTI_TENANT_ARCHITECTURE.md) - Architecture details

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review `CUSTOMER_MANIFEST.md` in customer directory
3. Check provisioning script output
4. Review this guide's Troubleshooting section
