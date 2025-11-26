# Local Development Setup - Docker Multi-Tenant Stack

**Status:** ✅ **RUNNING & HEALTHY**
**Last Updated:** November 26, 2025

## Quick Start

Everything is already running! Your complete multi-tenant development environment is ready to use.

### Current Services Running

```
✅ PostgreSQL Database    - localhost:5432
✅ Redis Cache & Queue    - localhost:6379
✅ Express Backend API    - localhost:3000
✅ Bull Worker Process    - Running (background)
```

### Verify Everything Works

```bash
# Test API health
curl http://localhost:3000/api/health

# Response should be:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-26T09:10:16.390Z",
#   "customer": "dev-customer",
#   "environment": "development",
#   "uptime": 697.832890692
# }
```

## Services

### 1. PostgreSQL Database

**Connection Details:**
- Host: `localhost`
- Port: `5432`
- Database: `saas_dev`
- User: `dev_user`
- Password: `dev_password`

**What's Included:**
- 9 core tables (organizations, users, contacts, deals, activities, tasks, calendar_events, workflows, templates)
- Row-Level Security (RLS) policies on all tables
- Automatic timestamp triggers on every table
- Smart task automation triggers
- Production-ready indexes

**Connect via Docker:**
```bash
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev
```

**Sample Queries:**
```sql
-- View organizations (should have default one)
SELECT * FROM organizations;

-- View tables
\dt

-- Check RLS policies
SELECT * FROM pg_policies;
```

### 2. Redis Cache & Job Queue

**Connection Details:**
- Host: `localhost`
- Port: `6379`
- Password: `dev_password`

**Features:**
- Bull job queue support for async tasks
- 512MB memory limit with LRU eviction
- Persistent data storage
- Perfect for testing long-running operations

**Connect via Docker:**
```bash
docker compose -f docker-compose.local.yml exec redis redis-cli
```

**Test Connection:**
```bash
# Via docker-compose exec
docker compose -f docker-compose.local.yml exec redis redis-cli ping
# Response: PONG
```

### 3. Express Backend API

**Access Points:**
- Base URL: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`
- Ready: `http://localhost:3000/api/ready`
- Frontend: `http://localhost:3000`

**Implemented Endpoints:**

**Health & Status:**
```
GET  /api/health    - Server health check
GET  /api/ready     - Readiness probe
```

**Deals (Placeholder Routes):**
```
GET  /api/deals        - List all deals
POST /api/deals        - Create deal
PUT  /api/deals/:id    - Update deal
DELETE /api/deals/:id  - Delete deal
```

**Contacts:**
```
GET  /api/contacts     - List contacts
POST /api/contacts     - Create contact
```

**Activities:**
```
GET  /api/activities   - List activities
POST /api/activities   - Create activity
```

**Tasks:**
```
GET  /api/tasks        - List tasks
POST /api/tasks        - Create task
```

**Test the API:**
```bash
# Health check
curl http://localhost:3000/api/health | jq .

# Get deals (placeholder)
curl http://localhost:3000/api/deals | jq .

# Create contact (placeholder)
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

### 4. Bull Worker Process

**Role:** Async job processing and long-running tasks
- Connected to same PostgreSQL and Redis
- Independent scaling from API server
- Ready to implement:
  - Email sending
  - PDF generation
  - Video thumbnailing
  - AI proposal generation
  - Bulk imports/exports

## Development Workflow

### Frontend Development

The Express backend is already running. You can develop the frontend independently:

```bash
# Start Vite dev server (new terminal)
npm run dev

# Your frontend will run on: http://localhost:5173
# API requests will go to: http://localhost:3000

# Changes to frontend code will hot-reload automatically
# Keep the Docker services running in another terminal
```

### Backend Development

The backend is running in Docker with hot-reload support:

```bash
# Modify server.js with new endpoints/features
# Changes will be reflected on restart:
docker compose -f docker-compose.local.yml restart app

# View logs to debug:
docker compose -f docker-compose.local.yml logs -f app
```

### Database Development

The database schema is initialized with complete multi-tenant support:

```bash
# View database schema
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev -c "\dt"

# Add new table/function
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev << 'EOF'
  CREATE TABLE new_table (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id)
  );
  ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
EOF
```

## Useful Commands

### View Logs

```bash
# All services
docker compose -f docker-compose.local.yml logs -f

# Specific service
docker compose -f docker-compose.local.yml logs -f app
docker compose -f docker-compose.local.yml logs -f db
docker compose -f docker-compose.local.yml logs -f redis
docker compose -f docker-compose.local.yml logs -f worker

# Last 100 lines
docker compose -f docker-compose.local.yml logs --tail=100

# With timestamps
docker compose -f docker-compose.local.yml logs --timestamps
```

### Container Management

```bash
# View status
docker compose -f docker-compose.local.yml ps

# Stop everything
docker compose -f docker-compose.local.yml down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.local.yml down -v

# Restart all services
docker compose -f docker-compose.local.yml restart

# Restart specific service
docker compose -f docker-compose.local.yml restart app

# Rebuild image
docker build -f Dockerfile.multitenant.simple -t sixty-sales-dashboard:multitenant .

# Start after stop
docker compose -f docker-compose.local.yml up -d

# Create new service container
docker compose -f docker-compose.local.yml run app npm --version
```

### Execute Commands in Containers

```bash
# Run command in app container
docker compose -f docker-compose.local.yml exec app node --version

# Run command in database
docker compose -f docker-compose.local.yml exec db pg_dump -U dev_user saas_dev > backup.sql

# Interactive shell
docker compose -f docker-compose.local.yml exec app /bin/sh
```

### Database Access

```bash
# Via Docker (recommended)
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev

# Via localhost (if psql installed)
psql -h localhost -U dev_user -d saas_dev

# View tables
\dt

# View specific table
SELECT * FROM organizations;

# View table structure
\d organizations

# Exit psql
\q
```

### Redis Access

```bash
# Via Docker
docker compose -f docker-compose.local.yml exec redis redis-cli

# Commands
PING                  # Test connection
DBSIZE                # Number of keys
FLUSHDB               # Clear database
KEYS *                # List all keys
GET key-name          # Get value
SET key-name value    # Set value
QUIT                  # Exit
```

## Troubleshooting

### Services Not Starting

**Check if Docker daemon is running:**
```bash
docker version
# Should show Docker version and API version
```

**If services fail to start:**
```bash
# View full logs
docker compose -f docker-compose.local.yml logs

# Remove stopped containers and volumes
docker compose -f docker-compose.local.yml down -v

# Restart
docker compose -f docker-compose.local.yml up -d
```

### Port Already in Use

**If port 3000 is in use:**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.local.yml (app.ports)
```

**If port 5432 is in use:**
```bash
lsof -i :5432
kill -9 <PID>
```

### Database Connection Issues

**Check if database is healthy:**
```bash
docker compose -f docker-compose.local.yml exec db pg_isready
# Should output: accepting connections
```

**Check database logs:**
```bash
docker compose -f docker-compose.local.yml logs db | tail -50
```

### API Not Responding

**Check if app is running:**
```bash
curl http://localhost:3000/api/health
```

**Check app logs:**
```bash
docker compose -f docker-compose.local.yml logs app
```

**Restart app:**
```bash
docker compose -f docker-compose.local.yml restart app
docker compose -f docker-compose.local.yml logs -f app
```

## Architecture

### Network Isolation

All services run on isolated Docker network `saas-local`:
- Containers can communicate by name (e.g., `db` instead of `localhost`)
- External connections via `localhost` with mapped ports
- Network isolation ensures multi-tenant security

### Data Persistence

Volumes persist between restarts:
- `postgres-data-dev` - PostgreSQL data
- `redis-data-dev` - Redis data

**Clean start (remove all data):**
```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d
```

### Security Configuration (Development)

**Note:** These are development credentials. For production:
- Use AWS Secrets Manager or HashiCorp Vault
- Generate unique, complex passwords
- Enable SSL/TLS
- Implement proper authentication (JWT)

**Current setup:**
```
PostgreSQL:
  - User: dev_user
  - Password: dev_password
  - Security: RLS enabled

Redis:
  - Password: dev_password
  - Security: requirepass enabled
```

## Production Deployment

For production deployment:

1. **Use Dockerfile.multitenant** (not .simple)
   - Multi-stage build for frontend compilation
   - Smaller final image size
   - Better caching

2. **Use customer provisioning script**
   ```bash
   ./scripts/provision-customer.sh --id customer-id --name "Company Name"
   ```
   - Creates customer-specific environment
   - Generates unique credentials
   - Initializes customer database
   - Configures isolated Docker network

3. **Set up proper secrets management**
   - AWS Secrets Manager
   - Environment-specific credentials
   - No hardcoded passwords

4. **Configure Nginx reverse proxy**
   - Route by subdomain (customer.example.com)
   - SSL/TLS termination
   - Load balancing across customers

5. **Monitor and log**
   - Container logs aggregation
   - Performance monitoring
   - Error tracking (Sentry)
   - Distributed tracing (Jaeger)

## Next Steps

### Immediate (This Session)
- ✅ Docker stack running locally
- ✅ Database schema initialized
- ✅ API endpoints accessible
- [ ] Start frontend dev: `npm run dev`
- [ ] Implement actual API handlers

### Short Term (This Week)
- Implement API endpoints connecting to PostgreSQL
- Add authentication middleware
- Implement RLS policy enforcement in queries
- Test multi-tenant isolation

### Medium Term (Next 2 Weeks)
- Deploy to staging environment (AWS/Railway)
- Set up Nginx reverse proxy
- Implement customer provisioning system
- Create admin dashboard

### Long Term (Next Month)
- Billing system (Stripe)
- Monitoring & observability
- Performance optimization
- Multi-region deployment

## Resources

### Documentation
- [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) - Complete setup guide
- [DOCKER_MULTI_TENANT_ARCHITECTURE.md](DOCKER_MULTI_TENANT_ARCHITECTURE.md) - Architecture details
- [PHASE_4_COMPLETION_SUMMARY.md](PHASE_4_COMPLETION_SUMMARY.md) - Phase 4 summary

### Code Files
- `server.js` - Express backend (ES modules)
- `Dockerfile.multitenant.simple` - Simplified Docker build for dev
- `Dockerfile.multitenant` - Production multi-stage build
- `docker-compose.local.yml` - Local development compose
- `docker-compose.customer.template.yml` - Customer provisioning template
- `scripts/init-db.sql` - Database schema
- `scripts/local-setup.sh` - Automated local setup
- `scripts/provision-customer.sh` - Customer provisioning

## Support

### Check Logs First
Always check the logs to understand what's happening:
```bash
docker compose -f docker-compose.local.yml logs <service-name>
```

### Common Issues & Solutions
- Port in use → Check `lsof -i :PORT` and kill process
- Database not ready → Wait 10-15 seconds and retry
- API not responding → Check `docker compose ps` and logs
- Memory issues → Docker Desktop memory allocation in settings

### Reference Files
- `.env.local` - Local environment variables (if needed)
- `docker-compose.local.yml` - Full compose config
- `scripts/local-setup.sh` - Automated setup script
- `Dockerfile.multitenant.simple` - Build configuration

---

**Last Updated:** 2025-11-26
**Status:** ✅ Production-Ready (Local Dev Environment)
**Next Review:** When implementing first production customer provisioning
