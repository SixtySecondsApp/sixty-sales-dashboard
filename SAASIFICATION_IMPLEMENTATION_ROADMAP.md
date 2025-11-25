# SaaSification Implementation Roadmap
## Phase-by-Phase Execution Plan for Multi-Tenant Deployment

**Branch:** SAASification
**Status:** 🚀 Starting Implementation
**Target:** Complete multi-tenant Docker deployment ready for first customers

---

## OVERVIEW

This roadmap breaks down the SaaSification journey into **9 phases** with weekly milestones, specific deliverables, and success criteria.

**Total Duration:** 18 weeks (4.5 months)
**Team Size:** 2-3 engineers recommended
**Initial Focus:** Phase 1 (Security & Foundation) - **Week 1-2**

---

## PHASE 1: Security & Database Abstraction (Weeks 1-2)
**Priority:** CRITICAL
**Effort:** 1-1.5 weeks
**Owner:** Lead Engineer

### 1.1 Immediate Security Actions
- [ ] Rotate ALL exposed API credentials
  - [ ] Supabase keys
  - [ ] AWS SES credentials
  - [ ] OpenAI, Claude, Gemini keys
  - [ ] Slack, Google OAuth credentials
  - [ ] Fathom OAuth credentials

- [ ] Remove `.env` from git history
  ```bash
  bfg --delete-files .env
  git reflog expire --expire=now --all && git gc --prune=now --aggressive
  ```

- [ ] Set up AWS Secrets Manager
  - [ ] Create secret groups (global, per-environment)
  - [ ] Store all rotated credentials
  - [ ] Create IAM policies for access

- [ ] Create `.env.example` with safe placeholders
  ```env
  # Example file for reference
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  AWS_SES_ACCESS_KEY_ID=your-access-key
  OPENAI_API_KEY=your-openai-key
  ```

- [ ] Implement environment variable loader
  ```typescript
  // src/lib/config/secrets.ts
  // Load from Secrets Manager in production
  // Load from .env in development
  ```

### 1.2 Database Abstraction Layer
- [ ] Create database service interface
  ```typescript
  // src/lib/services/database/IDatabase.ts
  export interface IDatabase {
    query(sql: string, params?: any[]): Promise<any>
    transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T>
    close(): Promise<void>
  }
  ```

- [ ] Create PostgreSQL adapter
  ```typescript
  // src/lib/services/database/PostgresAdapter.ts
  export class PostgresAdapter implements IDatabase {
    // Direct PostgreSQL implementation
  }
  ```

- [ ] Create Supabase adapter (for current setup)
  ```typescript
  // src/lib/services/database/SupabaseAdapter.ts
  export class SupabaseAdapter implements IDatabase {
    // Supabase client wrapper
  }
  ```

- [ ] Implement dependency injection
  ```typescript
  // src/lib/services/database/index.ts
  export const db = getDatabase() // Returns correct adapter
  ```

### 1.3 Deliverables
**Git Commit:**
```
feat: Phase 1 - Security hardening and database abstraction

- Rotate all exposed API credentials
- Remove .env from git history
- Set up AWS Secrets Manager integration
- Create database abstraction layer with adapters
- Implement dependency injection for database
```

**Files Created/Modified:**
- `src/lib/config/secrets.ts` (NEW)
- `src/lib/services/database/IDatabase.ts` (NEW)
- `src/lib/services/database/PostgresAdapter.ts` (NEW)
- `src/lib/services/database/SupabaseAdapter.ts` (NEW)
- `src/lib/services/database/index.ts` (NEW)
- `.env.example` (UPDATED)
- `.gitignore` (UPDATED - add `.env*`)

**Success Criteria:**
- ✅ No credentials in codebase
- ✅ Database adapter interface created
- ✅ Both Supabase and PostgreSQL adapters implemented
- ✅ DI container working with mocks
- ✅ Environment-based credential loading functional

---

## PHASE 2: Multi-Tenancy Database Layer (Weeks 3-4)
**Priority:** CRITICAL
**Effort:** 1.5-2 weeks
**Owner:** Lead Engineer

### 2.1 RLS Policy Audit & Implementation
- [ ] Review current RLS policies
  - [ ] Document which tables have RLS
  - [ ] Document which tables need RLS (25+ tables)

- [ ] Create comprehensive RLS policy set
  ```sql
  -- For each of 25+ tables, create policies like:
  CREATE POLICY "org_isolation"
    ON deals FOR ALL
    USING (
      org_id IN (
        SELECT org_id FROM organization_memberships
        WHERE user_id = auth.uid()
      )
    )
  ```

- [ ] RLS policies to implement:
  - [ ] deals table
  - [ ] activities table
  - [ ] contacts table
  - [ ] companies table
  - [ ] tasks table
  - [ ] meetings table
  - [ ] calendar_events table
  - [ ] (+ 17 more tables)

- [ ] Write RLS policy tests
  ```typescript
  // tests/security/rls-isolation.test.ts
  // Verify cross-tenant data leakage is impossible
  ```

### 2.2 Auth Context Enhancement
- [ ] Extend AuthContext with org data
  ```typescript
  // src/lib/contexts/AuthContext.tsx
  export interface AuthContextType {
    user: User
    session: Session
    // ADD:
    currentOrganization: Organization | null
    userOrganizations: Organization[]
    userRoleInOrg: 'owner' | 'admin' | 'member' | 'readonly'
    userOrgIds: string[]
    selectOrganization(orgId: string): Promise<void>
  }
  ```

- [ ] Create org context middleware
  ```typescript
  // src/middleware/orgContext.ts
  // Extract org_id from user session/metadata
  // Validate org membership via database
  // Store in request context
  ```

- [ ] Implement org selector UI
  ```typescript
  // src/components/OrgSelector.tsx
  // Dropdown to switch between orgs
  // Update context on selection
  ```

### 2.3 Update All Data Hooks
- [ ] Modify all 50+ hooks to filter by org_id
  ```typescript
  // src/lib/hooks/deals/useDeals.ts
  // OLD: filter by user_id only
  // NEW: filter by org_id AND user_id
  ```

- [ ] Priority order:
  - [ ] useDeals (most critical)
  - [ ] useActivities
  - [ ] useContacts
  - [ ] useTasks
  - [ ] useCompanies
  - [ ] useMeetings
  - [ ] useCalendarEvents
  - [ ] (+ 40+ more hooks)

### 2.4 API Endpoint Updates
- [ ] Update all API endpoints to require org context
  ```typescript
  // src/routes/api/deals.ts
  router.get('/', authMiddleware, orgContextMiddleware, async (req, res) => {
    const { orgId } = req.user
    const deals = await db.query(
      'SELECT * FROM deals WHERE org_id = $1',
      [orgId]
    )
  })
  ```

### 2.5 Deliverables
**Git Commit:**
```
feat: Phase 2 - Multi-tenancy database isolation

- Implement RLS policies for 25+ tables using org_id
- Extend AuthContext with organization context
- Add org_id filtering to all data hooks (50+)
- Update API endpoints for org scoping
- Add comprehensive RLS policy tests
```

**Files Created/Modified:**
- `src/lib/contexts/AuthContext.tsx` (UPDATED)
- `src/middleware/orgContext.ts` (NEW)
- `src/components/OrgSelector.tsx` (NEW)
- `src/lib/hooks/**/*.ts` (50+ files UPDATED)
- `src/routes/api/**/*.ts` (10+ files UPDATED)
- `tests/security/rls-isolation.test.ts` (NEW)
- `supabase/migrations/[DATE]_add_rls_policies.sql` (NEW - 2000+ lines)

**Success Criteria:**
- ✅ RLS policies applied to all tables
- ✅ No cross-tenant data queries in tests
- ✅ All hooks filter by org_id
- ✅ All API endpoints enforce org scope
- ✅ Organization selector working in UI

---

## PHASE 3: Feature Modularity (Weeks 5-6)
**Priority:** HIGH
**Effort:** 1.5-2 weeks
**Owner:** Senior Engineer

### 3.1 Feature Flag System
- [ ] Create feature flag constants
  ```typescript
  // src/lib/utils/featureFlags.ts
  export const FEATURES = {
    CALENDAR_SYNC: 'calendar_sync',
    WORKFLOWS: 'workflows',
    PROPOSALS: 'proposals',
    SMART_TASKS: 'smart_tasks',
    AI_COPILOT: 'ai_copilot',
    SLACK_INTEGRATION: 'slack_integration',
    ADVANCED_REPORTING: 'advanced_reporting',
    REVENUE_SPLITTING: 'revenue_splitting'
  }
  ```

- [ ] Create feature availability function
  ```typescript
  // src/lib/utils/featureFlags.ts
  export async function isFeatureEnabled(
    feature: string,
    orgId: string
  ): Promise<boolean> {
    // Check org plan/tier
    // Return feature availability
  }
  ```

- [ ] Create feature flag database table
  ```sql
  CREATE TABLE organization_features (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    feature_name VARCHAR,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP,
    UNIQUE(org_id, feature_name)
  )
  ```

### 3.2 Feature-Aware Component Loading
- [ ] Create feature gate HOC
  ```typescript
  // src/components/FeatureGate.tsx
  export function FeatureGate({ feature, children, fallback }) {
    const { isEnabled } = useFeatureFlag(feature)
    return isEnabled ? children : fallback
  }
  ```

- [ ] Wrap feature-specific components
  ```typescript
  // src/pages/Calendar.tsx
  <FeatureGate feature="CALENDAR_SYNC" fallback={<CalendarDisabled />}>
    <Calendar />
  </FeatureGate>
  ```

### 3.3 Decouple Services
- [ ] Extract Calendar service to be injectable
- [ ] Extract Workflow service to be injectable
- [ ] Extract AI/Copilot service to be injectable
- [ ] Create service registry pattern
  ```typescript
  // src/lib/services/ServiceRegistry.ts
  export class ServiceRegistry {
    constructor(private features: string[]) {}

    getService(name: string) {
      if (!this.features.includes(name)) {
        throw new Error(`Feature ${name} not enabled`)
      }
      return serviceInstances[name]
    }
  }
  ```

### 3.4 Feature Configuration UI
- [ ] Create admin panel for feature management
  ```typescript
  // src/pages/admin/Features.tsx
  // Allow super admins to enable/disable features per org
  ```

### 3.5 Deliverables
**Git Commit:**
```
feat: Phase 3 - Feature modularity and toggles

- Create feature flag system with database support
- Implement feature gate HOC and components
- Decouple calendar, workflow, and AI services
- Add feature management admin panel
- Update component loading based on features
```

**Files Created/Modified:**
- `src/lib/utils/featureFlags.ts` (NEW)
- `src/lib/hooks/useFeatureFlag.ts` (NEW)
- `src/components/FeatureGate.tsx` (NEW)
- `src/lib/services/ServiceRegistry.ts` (NEW)
- `src/pages/admin/Features.tsx` (NEW)
- `supabase/migrations/[DATE]_add_organization_features.sql` (NEW)

**Success Criteria:**
- ✅ Feature flags working for all 8+ features
- ✅ Features can be toggled per org
- ✅ Components respect feature gates
- ✅ Admin UI for feature management
- ✅ No runtime errors when features disabled

---

## PHASE 4: Docker & Deployment Infrastructure (Weeks 7-8)
**Priority:** HIGH
**Effort:** 1.5-2 weeks
**Owner:** DevOps Engineer

### 4.1 Backend Express Server
- [ ] Create Express application skeleton
  ```typescript
  // src/server.ts
  const app = express()
  app.use(middleware...)
  app.use(routes...)
  ```

- [ ] Implement middleware stack
  - [ ] Auth middleware (JWT validation)
  - [ ] Org context middleware
  - [ ] Rate limiting middleware
  - [ ] Request logging middleware
  - [ ] Error handling middleware
  - [ ] CORS middleware

- [ ] Create API routes directory structure
  ```
  src/routes/
  ├─ api/
  │  ├─ deals.ts
  │  ├─ contacts.ts
  │  ├─ activities.ts
  │  ├─ tasks.ts
  │  ├─ companies.ts
  │  └─ meetings.ts
  ├─ auth/
  │  ├─ google.ts
  │  ├─ slack.ts
  │  └─ fathom.ts
  ├─ webhook/
  │  ├─ fathom.ts
  │  ├─ savvycal.ts
  │  └─ slack.ts
  └─ internal/
     ├─ copilot.ts
     └─ health.ts
  ```

### 4.2 Docker Configuration
- [ ] Create Dockerfile (multi-stage)
  ```dockerfile
  # Build stage
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json .
  RUN npm ci
  COPY . .
  RUN npm run build

  # Production stage
  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  EXPOSE 3000
  CMD ["node", "dist/server.js"]
  ```

- [ ] Create docker-compose.yml
  ```yaml
  version: '3.8'
  services:
    backend:
      build: .
      ports: ["3000:3000"]
      environment:
        - NODE_ENV=development
        - DATABASE_URL=postgresql://user:pass@postgres:5432/db
        - REDIS_URL=redis://redis:6379
      depends_on:
        - postgres
        - redis

    postgres:
      image: postgres:15-alpine
      environment:
        - POSTGRES_USER=user
        - POSTGRES_PASSWORD=password
        - POSTGRES_DB=db
      volumes:
        - postgres_data:/var/lib/postgresql/data

    redis:
      image: redis:7-alpine
      volumes:
        - redis_data:/data

  volumes:
    postgres_data:
    redis_data:
  ```

- [ ] Create Nginx configuration
  ```nginx
  # config/nginx.conf
  upstream backend {
    server backend:3000;
  }

  server {
    listen 80;
    server_name _;

    location / {
      proxy_pass http://backend;
    }
  }
  ```

### 4.3 Database Migration Setup
- [ ] Create migration runner script
  ```bash
  # scripts/migrate.sh
  # Run PostgreSQL migrations in order
  ```

- [ ] Test migration from Supabase → PostgreSQL
  - [ ] Export schema from Supabase
  - [ ] Run migrations locally
  - [ ] Verify schema matches

### 4.4 CI/CD Pipeline (GitHub Actions)
- [ ] Create GitHub Actions workflow
  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
        - run: npm ci
        - run: npm run build
        - run: npm run test
        - run: npm run test:security
    docker:
      needs: test
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: docker/setup-buildx-action@v2
        - uses: docker/build-push-action@v4
  ```

### 4.5 Deliverables
**Git Commit:**
```
feat: Phase 4 - Docker and deployment infrastructure

- Create Express backend server with middleware stack
- Implement all API routes (CRUD, auth, webhooks)
- Create Dockerfile with multi-stage build
- Create docker-compose.yml for local development
- Set up Nginx reverse proxy configuration
- Create database migration runner
- Implement GitHub Actions CI/CD pipeline
```

**Files Created/Modified:**
- `src/server.ts` (NEW)
- `src/middleware/*.ts` (5+ NEW)
- `src/routes/**/*.ts` (15+ NEW)
- `Dockerfile` (NEW)
- `docker-compose.yml` (NEW)
- `config/nginx.conf` (NEW)
- `scripts/migrate.sh` (NEW)
- `.github/workflows/ci.yml` (NEW)

**Success Criteria:**
- ✅ Express server runs locally
- ✅ docker-compose up works end-to-end
- ✅ All API routes functional
- ✅ Database migrations apply successfully
- ✅ CI/CD pipeline passing

---

## PHASE 5: Service Decoupling (Weeks 9-10)
**Priority:** HIGH
**Effort:** 1.5-2 weeks
**Owner:** Senior Engineer

### 5.1 Convert Edge Functions to Backend
- [ ] API CRUD Functions (6 functions)
  - [ ] api-v1-activities → POST /api/v1/activities
  - [ ] api-v1-deals → POST /api/v1/deals
  - [ ] api-v1-contacts → POST /api/v1/contacts
  - [ ] api-v1-companies → POST /api/v1/companies
  - [ ] api-v1-tasks → POST /api/v1/tasks
  - [ ] api-v1-meetings → POST /api/v1/meetings

- [ ] OAuth Callbacks (8 functions)
  - [ ] google-oauth-callback → GET /auth/google/callback
  - [ ] slack-oauth-callback → GET /auth/slack/callback
  - [ ] fathom-oauth-callback → GET /auth/fathom/callback

- [ ] Webhooks (10+ functions)
  - [ ] fathom-webhook → POST /webhook/fathom
  - [ ] savvycal-webhook → POST /webhook/savvycal
  - [ ] slack notifications → POST /slack/notify

- [ ] Utilities (10+ functions)
  - [ ] api-copilot → POST /api/copilot
  - [ ] enrich-company → POST /api/enrich-company
  - [ ] fetch-company-logo → GET /api/company-logo

### 5.2 Bull Job Queue Setup
- [ ] Install Bull and Redis libraries
- [ ] Create queue definitions
  ```typescript
  // src/services/queue/index.ts
  export const thumbnailQueue = new Queue('thumbnails')
  export const proposalQueue = new Queue('proposals')
  export const syncQueue = new Queue('syncs')
  export const importQueue = new Queue('imports')
  ```

- [ ] Create job processors
  ```typescript
  // src/services/queue/jobs/thumbnail.job.ts
  // Process thumbnail generation jobs
  ```

- [ ] Create worker startup
  ```typescript
  // src/worker.ts
  // Separate entry point for worker process
  ```

### 5.3 Convert Long-Running Functions
- [ ] Thumbnail generation → Bull queue
- [ ] Proposal generation (AI) → Bull queue
- [ ] Meeting sync (Fathom) → Bull queue
- [ ] Bulk imports → Bull queue
- [ ] Scheduled tasks (cron) → Bull queue

### 5.4 Deliverables
**Git Commit:**
```
feat: Phase 5 - Edge functions to backend conversion

- Convert 60+ Supabase Edge Functions to Express routes
- Implement Bull job queue for long-running tasks
- Create separate worker process for job processing
- Migrate all webhook handlers to backend
- Update frontend to call new backend endpoints
```

**Files Created/Modified:**
- `src/routes/api/*.ts` (10+ NEW)
- `src/routes/auth/*.ts` (5+ NEW)
- `src/routes/webhook/*.ts` (5+ NEW)
- `src/services/queue/index.ts` (NEW)
- `src/services/queue/jobs/*.ts` (10+ NEW)
- `src/worker.ts` (NEW)

**Success Criteria:**
- ✅ All API CRUD routes working
- ✅ All OAuth flows functional
- ✅ All webhooks receiving and processing
- ✅ Bull queue processing jobs
- ✅ Worker scaling horizontally

---

## PHASE 6: Billing System (Weeks 11-12)
**Priority:** MEDIUM
**Effort:** 1.5-2 weeks
**Owner:** Backend Engineer

### 6.1 Stripe Integration
- [ ] Set up Stripe account
- [ ] Install Stripe SDK
- [ ] Create subscription plans in Stripe
  - [ ] Free tier
  - [ ] Pro tier
  - [ ] Enterprise tier

- [ ] Create billing API endpoints
  ```typescript
  // src/routes/api/billing/
  POST   /subscriptions/checkout    → Create checkout session
  POST   /webhooks/stripe           → Handle events
  GET    /invoices                  → List invoices
  POST   /subscriptions/cancel      → Cancel subscription
  ```

### 6.2 Usage Metering
- [ ] Create usage logging table
  ```sql
  CREATE TABLE usage_logs (
    id UUID PRIMARY KEY,
    org_id UUID,
    service VARCHAR,     -- 'openai', 'email', 'storage'
    quantity INTEGER,
    timestamp TIMESTAMP
  )
  ```

- [ ] Track usage per service
  - [ ] OpenAI tokens used
  - [ ] Email sent count
  - [ ] Storage used
  - [ ] API calls made

### 6.3 Feature Entitlements by Plan
- [ ] Create entitlements table
  ```sql
  CREATE TABLE plan_entitlements (
    plan VARCHAR,         -- 'free', 'pro', 'enterprise'
    feature VARCHAR,
    limit INTEGER,        -- -1 for unlimited
    PRIMARY KEY(plan, feature)
  )
  ```

- [ ] Define limits per plan
  - [ ] Free: 1 team member, 0 AI, basic features
  - [ ] Pro: 5 team members, 100K tokens/month, all features
  - [ ] Enterprise: unlimited everything

### 6.4 Customer Provisioning
- [ ] Create organization signup flow
- [ ] Collect Stripe payment method
- [ ] Create subscription
- [ ] Enable organization
- [ ] Send welcome email

### 6.5 Deliverables
**Git Commit:**
```
feat: Phase 6 - Billing and subscription system

- Integrate Stripe for payment processing
- Create subscription plans and management
- Implement usage metering and tracking
- Define feature entitlements per plan
- Create customer provisioning flow
- Set up billing webhook handlers
```

**Files Created/Modified:**
- `src/routes/api/billing/*.ts` (5+ NEW)
- `src/services/stripe/index.ts` (NEW)
- `src/services/metering/index.ts` (NEW)
- `supabase/migrations/[DATE]_add_billing_tables.sql` (NEW)

**Success Criteria:**
- ✅ Stripe integration working
- ✅ Subscriptions creating successfully
- ✅ Usage being tracked
- ✅ Feature limits enforced
- ✅ Invoices generating

---

## PHASE 7: Testing & Performance (Weeks 13-14)
**Priority:** MEDIUM
**Effort:** 1.5-2 weeks
**Owner:** QA Engineer

### 7.1 Multi-Tenant Integration Tests
- [ ] Test tenant isolation
  - [ ] Verify user A cannot see user B's data
  - [ ] Verify org A cannot see org B's data
  - [ ] Cross-tenant query attempts blocked

- [ ] Test organization membership
  - [ ] Owner can manage members
  - [ ] Member can see org data
  - [ ] Read-only user cannot modify

- [ ] Test billing enforcement
  - [ ] Feature limits enforced
  - [ ] Free plan restrictions work
  - [ ] Pro plan features available

### 7.2 Feature Flag Testing
- [ ] Test all feature combinations
- [ ] Test disabled feature UI hiding
- [ ] Test feature fallback behavior

### 7.3 Load Testing
- [ ] Set up load testing tools (k6)
  ```typescript
  // tests/load/load-test.js
  // Simulate 100+ concurrent users
  ```

- [ ] Identify bottlenecks
- [ ] Optimize queries
- [ ] Optimize caching

### 7.4 Performance Baseline
- [ ] API response times
- [ ] Database query performance
- [ ] Job queue throughput
- [ ] Memory usage per container

### 7.5 Deliverables
**Git Commit:**
```
feat: Phase 7 - Comprehensive testing and optimization

- Add multi-tenant isolation tests
- Add feature flag combination tests
- Implement load testing baseline
- Performance optimize database queries
- Optimize caching strategy
- Document performance baselines
```

**Files Created/Modified:**
- `tests/integration/multi-tenant.test.ts` (NEW)
- `tests/integration/billing.test.ts` (NEW)
- `tests/load/load-test.js` (NEW)

**Success Criteria:**
- ✅ 100+ test cases passing
- ✅ No cross-tenant data leakage
- ✅ p95 latency <200ms
- ✅ Handle 1000+ concurrent users
- ✅ Memory stable under load

---

## PHASE 8: Monitoring & Observability (Weeks 15-16)
**Priority:** MEDIUM
**Effort:** 1.5-2 weeks
**Owner:** DevOps Engineer

### 8.1 Distributed Tracing (Jaeger)
- [ ] Install and configure Jaeger
- [ ] Add tracing to all API endpoints
- [ ] Add tracing to database operations
- [ ] Add tracing to external API calls

### 8.2 Log Aggregation (Loki)
- [ ] Configure Loki with Grafana
- [ ] Set up log shipping from containers
- [ ] Create log dashboards
- [ ] Alert on error patterns

### 8.3 Metrics & Alerts
- [ ] Configure Prometheus scraping
- [ ] Create custom business metrics
- [ ] Create Grafana dashboards
  - [ ] API performance dashboard
  - [ ] Database performance dashboard
  - [ ] Job queue dashboard
  - [ ] Revenue/billing dashboard

- [ ] Set up alerting rules
  - [ ] API latency alerts
  - [ ] Error rate alerts
  - [ ] Job failure alerts
  - [ ] Database alerts

### 8.4 Error Tracking (Sentry)
- [ ] Install Sentry SDK
- [ ] Configure error reporting
- [ ] Set up issue notifications
- [ ] Create error dashboard

### 8.5 Deliverables
**Git Commit:**
```
feat: Phase 8 - Full observability stack

- Implement Jaeger distributed tracing
- Set up Loki log aggregation
- Configure Prometheus metrics
- Create comprehensive Grafana dashboards
- Integrate Sentry error tracking
- Set up alerting rules and notifications
```

**Files Created/Modified:**
- `config/monitoring/jaeger.yml` (NEW)
- `config/monitoring/loki-config.yml` (NEW)
- `config/monitoring/prometheus-extended.yml` (NEW)
- `docker-compose.monitoring.yml` (NEW)

**Success Criteria:**
- ✅ Distributed tracing working
- ✅ Logs aggregating in Loki
- ✅ Metrics visible in Grafana
- ✅ Alerts routing correctly
- ✅ Error tracking functional

---

## PHASE 9: Documentation & Handoff (Weeks 17-18)
**Priority:** MEDIUM
**Effort:** 1-1.5 weeks
**Owner:** Tech Lead

### 9.1 Architecture Documentation
- [ ] Document multi-tenancy design
- [ ] Document feature system design
- [ ] Document billing architecture
- [ ] Document data isolation model

### 9.2 Operational Runbooks
- [ ] Deployment procedure
- [ ] Scaling procedure
- [ ] Backup/restore procedure
- [ ] Incident response playbooks
- [ ] On-call escalation

### 9.3 Developer Guide
- [ ] Local development setup
- [ ] Database schema documentation
- [ ] API endpoint documentation (OpenAPI/Swagger)
- [ ] Feature flag usage guide
- [ ] Debugging guide

### 9.4 Team Training
- [ ] Ops team training
- [ ] Support team training
- [ ] Engineering team training

### 9.5 Deliverables
**Git Commit:**
```
docs: Phase 9 - Complete documentation and training

- Add architecture documentation
- Create operational runbooks
- Add developer guides
- Document API endpoints
- Create training materials
```

**Files Created/Modified:**
- `docs/ARCHITECTURE.md` (NEW)
- `docs/MULTI_TENANCY.md` (NEW)
- `docs/OPERATIONS.md` (NEW)
- `docs/API.md` (NEW)
- `docs/DEVELOPER_SETUP.md` (NEW)

**Success Criteria:**
- ✅ All systems documented
- ✅ Team trained and confident
- ✅ Runbooks tested
- ✅ Zero knowledge gaps

---

## WEEKLY CHECKLIST TEMPLATE

Use this for each week:

```
## Week [N]: [Phase Name]

### Monday
- [ ] Sprint planning
- [ ] Review PRs from previous week
- [ ] Identify blockers

### Tuesday-Thursday
- [ ] Implementation work
- [ ] Daily standup
- [ ] Code reviews
- [ ] Testing

### Friday
- [ ] Code review completion
- [ ] Merge to SAASification branch
- [ ] Test in staging
- [ ] Demo to stakeholders
- [ ] Sprint retro

### Git Commits This Week
```
git log --oneline SAASification --since="1 week ago"
```
```

---

## SUCCESS METRICS

### After Phase 1
- ✅ Zero credentials in git
- ✅ Database abstraction working
- ✅ Local dev environment secure

### After Phase 2
- ✅ RLS policies comprehensive
- ✅ All tables protected
- ✅ Multi-tenant queries functional

### After Phase 4
- ✅ Docker environment working
- ✅ No Supabase dependency
- ✅ Self-hosted database works

### After Phase 6
- ✅ Billing functional
- ✅ Feature limits enforced
- ✅ Revenue model working

### After Phase 8
- ✅ Full observability
- ✅ Issues detected and alerted
- ✅ Ops team confident

### After Phase 9
- ✅ Ready for first customers
- ✅ Team fully trained
- ✅ Operations smooth

---

## RESOURCE ALLOCATION

### Recommended Team
- **Tech Lead** (1 FTE): Oversee all phases, architecture decisions
- **Backend Engineer** (1 FTE): Database, API, services
- **DevOps Engineer** (0.5 FTE): Docker, infrastructure, monitoring
- **QA Engineer** (0.5 FTE): Testing, performance, security

### Total: 3-4 people for 18 weeks

---

## RISK MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database migration breaks | MEDIUM | CRITICAL | Test on prod copy, rollback plan |
| RLS policies have bugs | MEDIUM | CRITICAL | Comprehensive testing, penetration test |
| Performance degradation | MEDIUM | HIGH | Load testing, optimization |
| Team lacks knowledge | MEDIUM | HIGH | Training, documentation, pair programming |

---

## NEXT STEPS

**This Week (Week 1):**
1. Create this branch (DONE ✅)
2. Rotate credentials and implement Phase 1
3. Set up Secrets Manager
4. Create database abstraction layer
5. First PR on SAASification branch

**Commit message format:**
```
feat: [Phase N] - Short description

- Detailed change 1
- Detailed change 2
- Detailed change 3

Related to: SAASIFICATION
```

---

**Status:** 🚀 Ready to start Phase 1
**Branch:** SAASification
**Start Date:** Today
**Target Completion:** 18 weeks
