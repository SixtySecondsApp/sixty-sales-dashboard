# Admin Dashboard - Local Deployment Guide

## ✅ Deployment Status: LIVE

Your admin dashboard is now deployed and running locally via Docker!

---

## 🌐 Access URLs

### Main Application
- **Frontend:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin

### API Endpoints
- **Health Check:** http://localhost:3000/api/health
- **Provisioning API:** http://localhost:3000/api/provision
- **Get Customer Status:** http://localhost:3000/api/provision/:customerId

### Databases
- **Customer Database:** localhost:5432 (PostgreSQL)
  - User: `dev_user`
  - Password: `dev_password`
  - Database: `saas_dev`

- **Admin Database:** localhost:5433 (PostgreSQL)
  - User: `admin_user`
  - Password: `admin_password`
  - Database: `saas_admin`

### Cache & Queue
- **Redis:** localhost:6379
  - Password: `dev_password`

---

## 🚀 What's Running

### Services
1. **saas-app-dev** ✅ Healthy
   - Express.js backend with React frontend
   - Port: 3000
   - Status: Running

2. **saas-admin-db-dev** ✅ Healthy
   - PostgreSQL admin control plane
   - Port: 5433 (mapped from 5432)
   - Features: 9 admin tables, 10 feature modules pre-seeded

3. **saas-db-dev** ✅ Healthy
   - PostgreSQL customer database template
   - Port: 5432
   - Features: CRM schema, RLS policies, multi-org support

4. **saas-redis-dev** ✅ Healthy
   - Redis cache & job queue
   - Port: 6379
   - Max Memory: 512MB with LRU eviction

5. **saas-worker-dev** ✅ Healthy
   - Bull job queue worker
   - Processes async jobs from Redis

---

## 📊 Admin Dashboard Features

### Components Built
1. **AdminDashboard.tsx** - Main dashboard with 5 tabs
2. **AdminCustomersList.tsx** - Customer management table with search & filters
3. **CustomerDetailModal.tsx** - Customer detail view with modules & API keys
4. **AdminAnalytics.tsx** - Usage analytics with charts
5. **AdminApiKeys.tsx** - API key management interface
6. **AdminBilling.tsx** - Subscription & invoicing management

### Dashboard Tabs

#### Overview Tab
- API call metrics
- Customer growth trends
- Token usage by AI provider
- Revenue analytics

#### Customers Tab
- Search by name, domain, or email
- Filter by plan (Starter/Pro/Enterprise)
- Filter by status (Active/Trial)
- Color-coded badges
- Actions: View Details, Manage Modules, Suspend

#### Analytics Tab
- Detailed charts and metrics
- Time range selector (Day/Week/Month/Year)
- Revenue by plan breakdown
- Token usage distribution
- Customer growth tracking

#### API Keys Tab
- Create new API keys with permissions
- Configure rate limits
- View usage statistics
- Revoke or delete keys
- Show/hide full keys with copy functionality

#### Billing Tab
- Active subscriptions list
- Invoice history with status
- Monthly recurring revenue (MRR)
- Revenue collection tracking
- Download invoices
- Retry failed payments

---

## 🛠️ Docker Setup Details

### Build Info
- **Image Base:** Node 20 Alpine
- **Frontend Build:** Vite production build
- **Node Modules:** Optimized with `--only=production`
- **Health Checks:** Enabled on all services

### Volumes
- `postgres-admin-data-dev` - Admin DB persistence
- `postgres-data-dev` - Customer DB persistence
- `redis-data-dev` - Redis persistence
- Application code mounted for hot-reload

### Network
- **Network Name:** saas-local
- **Network Bridge:** br-saas-dev
- Services communicate via service names (e.g., `admin-db:5432`)

---

## 📝 Common Commands

### Start Services
```bash
docker compose -f docker-compose.local.yml up -d
```

### Stop Services
```bash
docker compose -f docker-compose.local.yml down
```

### View Logs
```bash
# All services
docker compose -f docker-compose.local.yml logs -f

# Specific service
docker compose -f docker-compose.local.yml logs -f app
docker compose -f docker-compose.local.yml logs -f admin-db
```

### Rebuild Services
```bash
docker compose -f docker-compose.local.yml up -d --build
```

### Access Admin Database
```bash
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin
```

### Access Customer Database
```bash
docker compose -f docker-compose.local.yml exec -T db psql -U dev_user -d saas_dev
```

### Check Container Status
```bash
docker compose -f docker-compose.local.yml ps
```

---

## 🔌 Testing the Admin Dashboard

### 1. Open in Browser
```
http://localhost:3000/admin
```

### 2. Test Provisioning API
```bash
# Provision a new customer
curl -X POST http://localhost:3000/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-customer",
    "customerName": "Test Customer Corp",
    "customerEmail": "admin@testcorp.com",
    "plan": "pro",
    "modules": ["crm_core", "advanced_pipeline", "ai_assistant"],
    "timezone": "America/New_York"
  }'

# Get customer status
curl http://localhost:3000/api/provision/test-customer
```

### 3. Verify Admin Database
```bash
# Check customers
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin \
  -c "SELECT company_name, company_domain, subscription_plan FROM admin_customers LIMIT 5;"

# Check feature modules
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin \
  -c "SELECT module_key, module_name FROM admin_feature_modules;"
```

---

## 🎨 Design System

### Color Scheme
- **Primary Accent:** Orange (#f97316, #ea580c)
- **Plans:**
  - Starter: Blue (#3b82f6)
  - Pro: Purple (#a855f7)
  - Enterprise: Orange (#f97316)

- **Status:**
  - Active: Green (#22c55e)
  - Trial: Yellow (#eab308)
  - Suspended: Red (#ef4444)

### Components
- Dark mode support with CSS variables
- Glass morphism effects (backdrop blur)
- Responsive grid layouts
- Shadcn UI component library
- Smooth transitions and hover states

---

## 📦 Deployment Stack

| Component | Technology | Port | Status |
|-----------|-----------|------|--------|
| Frontend | React 18 + Vite | 3000 | ✅ |
| Backend | Express.js | 3000 | ✅ |
| Admin DB | PostgreSQL 16 | 5433 | ✅ |
| Customer DB | PostgreSQL 16 | 5432 | ✅ |
| Cache/Queue | Redis 7 | 6379 | ✅ |
| Worker | Bull Queue | — | ✅ |

---

## 🔒 Security Notes

### Default Credentials (Development Only)
- **Admin DB:** admin_user / admin_password
- **Customer DB:** dev_user / dev_password
- **Redis:** dev_password
- **JWT Secret:** dev-jwt-secret-change-in-production

⚠️ **WARNING:** These are development credentials. DO NOT use in production.

### Production Recommendations
1. Use strong, unique passwords
2. Enable SSL/TLS for databases
3. Implement API key authentication
4. Use secrets management (AWS Secrets Manager, HashiCorp Vault)
5. Enable database backups
6. Use environment variables for sensitive data

---

## 🐛 Troubleshooting

### Application won't start
```bash
# Check logs
docker compose -f docker-compose.local.yml logs app

# Rebuild
docker compose -f docker-compose.local.yml up -d --build

# Check port conflicts
lsof -i :3000
```

### Database connection issues
```bash
# Test database connection
docker compose -f docker-compose.local.yml exec -T admin-db pg_isready -U admin_user

# View admin DB logs
docker compose -f docker-compose.local.yml logs admin-db
```

### Redis connection issues
```bash
# Test redis connection
docker compose -f docker-compose.local.yml exec -T redis redis-cli ping
```

### Dashboard not loading
1. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. Check http://localhost:3000/api/health
3. Check browser console for errors (F12)
4. View app logs: `docker compose -f docker-compose.local.yml logs -f app`

---

## 📚 Next Steps

### Integration
1. Replace mock data with real API calls
2. Implement user authentication
3. Add customer database provisioning (Phase 3)
4. Implement credential management
5. Set up automated backups

### Enhancements
1. Add real-time data updates with WebSockets
2. Implement advanced filtering and sorting
3. Add export functionality (CSV, PDF)
4. Implement audit logging for admin actions
5. Add dashboard customization options

### Deployment
1. For staging: Use AWS ECS or Kubernetes
2. For production: Multi-region deployment with load balancing
3. Set up CI/CD pipeline with GitHub Actions
4. Configure automated backups and disaster recovery

---

## 📞 Support

For issues or questions:
1. Check Docker logs: `docker compose logs -f`
2. Verify all services are healthy: `docker compose ps`
3. Test health endpoint: `curl http://localhost:3000/api/health`
4. Check database connectivity

---

**Deployment Date:** November 26, 2025
**Version:** 1.0.0 - Admin Dashboard Complete
**Environment:** Local Development (Docker Compose)
