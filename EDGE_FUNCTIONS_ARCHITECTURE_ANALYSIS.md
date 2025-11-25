# Edge Functions Architecture Analysis & Migration Strategy
## From Supabase Edge Functions to Docker with AWS Lambda@Edge or Alternatives

**Date:** November 24, 2025
**Topic:** Analyzing 89 Edge Functions and their viability in Docker-based multi-tenant architecture

---

## EXECUTIVE SUMMARY

You have **89 Supabase Edge Functions** that serve critical roles in your application. The question of whether to keep them, migrate to AWS Lambda@Edge, or move them into your backend is **nuanced and depends on function purpose**.

### Key Finding: Not All Edge Functions Should Stay at the Edge

**Recommended Approach:** Categorize functions into 3 tiers:
1. **Tier 1 (Keep at Edge):** 15-20 functions - Request routing, auth, rate limiting (AWS Lambda@Edge or CloudFlare Workers)
2. **Tier 2 (Move to Backend):** 50-60 functions - API endpoints, webhooks, integrations (Docker-based Node.js service)
3. **Tier 3 (Keep as Serverless):** 10-15 functions - Heavy computation, async processing (AWS Lambda or SQS/Bull job queue)

**Current Issue:** Supabase Edge Functions are tightly coupled to Supabase client, which breaks when you migrate to self-hosted PostgreSQL.

---

## 1. CURRENT EDGE FUNCTION INVENTORY

### 1.1 Total Functions: 89

**Breakdown by Category:**

```
API Endpoints (6 functions)
├─ api-v1-activities       → CRUD operations on activities
├─ api-v1-companies        → CRUD operations on companies
├─ api-v1-contacts         → CRUD operations on contacts
├─ api-v1-deals            → CRUD operations on deals
├─ api-v1-meetings         → CRUD operations on meetings
└─ api-v1-tasks            → CRUD operations on tasks

Authentication & Authorization (4 functions)
├─ api-auth                → Auth validation and token refresh
├─ auth-logger             → Auth event logging
├─ auth-rate-limit         → Per-user/IP rate limiting
└─ impersonate-user        → Admin impersonation (dangerous)

Google Integration (8 functions)
├─ google-oauth-initiate   → Start OAuth flow
├─ google-oauth-callback   → OAuth callback handler
├─ google-oauth-exchange   → Token exchange
├─ google-oauth-callback-public → Public callback (duplicate?)
├─ google-calendar         → Calendar sync
├─ google-tasks            → Google Tasks sync
├─ google-drive            → Drive file operations
└─ google-docs             → Docs creation/editing
└─ google-docs-create      → Docs creation

Slack Integration (4 functions)
├─ slack-oauth-callback    → OAuth callback
├─ send-slack-message      → Send webhook messages
├─ send-slack-notification → Send task notifications
└─ send-slack-task-notification → Task-specific notifications

Fathom Integration (5 functions)
├─ fathom-oauth-initiate   → Start OAuth flow
├─ fathom-oauth-callback   → OAuth callback
├─ fathom-webhook          → Webhook receiver
├─ fathom-sync             → Sync meetings/transcripts
├─ fathom-cron-sync        → Scheduled sync
├─ fathom-transcript-retry → Retry failed transcripts
└─ fathom-backfill-companies → Backfill company data

AI & Content Generation (12+ functions)
├─ generate-video-thumbnail → Video thumbnail generation
├─ generate-video-thumbnail-v2 → V2 of thumbnail generation
├─ generate-proposal        → AI proposal generation
├─ generate-marketing-content → Marketing copy generation
├─ generate-more-actions    → Suggest next actions
├─ suggest-next-actions     → AI-powered suggestions
├─ ask-meeting-ai           → Meeting analysis
├─ extract-action-items     → AI action item extraction
├─ analyze-action-item      → Action item analysis
├─ fetch-summary            → Meeting summary fetching
├─ condense-meeting-summary → Summary condensing
└─ reprocess-meetings-ai    → Reprocess with new AI model

Data Operations (15+ functions)
├─ add-activity             → Quick activity creation
├─ add-sale                 → Quick sale recording
├─ bulk-import-activities   → Bulk import handler
├─ create-deal-stages       → Pipeline stage creation
├─ create-task-from-action-item → Auto-task creation
├─ calculate-deal-health    → Health scoring
├─ deal-activities          → Deal-specific activities
├─ pipeline-tables          → Pipeline data operations
└─ [more data operations]

Utilities & Helpers (20+ functions)
├─ api-copilot              → AI copilot backend
├─ api-proxy                → Request proxying
├─ create-api-key           → API key generation
├─ enrich-company           → Company data enrichment
├─ enrich-crm-record        → CRM record enrichment
├─ extract-content-topics   → Content analysis
├─ fetch-company-logo       → Logo fetching
├─ process-single-activity  → Activity processing
├─ [more utilities]

Webhooks & External Services (20+ functions)
├─ savvycal-leads-webhook   → SavvyCal webhook handler
├─ import-savvycal-bookings → Booking import
└─ [various webhook handlers]

Analytics & Monitoring (5+ functions)
├─ analytics-web-vitals     → Web Vitals tracking
└─ [monitoring functions]

Total: 89 functions
```

### 1.2 Current Architecture Issues

```
Supabase Edge Functions (Deno Runtime)
    ↓
Each function imports:
├─ https://esm.sh/@supabase/supabase-js@2
├─ Hardcoded VITE_SUPABASE_URL
├─ Hardcoded VITE_SUPABASE_SERVICE_ROLE_KEY
└─ Direct Supabase client initialization

When you move to self-hosted PostgreSQL:
├─ @supabase/supabase-js becomes invalid
├─ Environment variables won't exist
├─ Service role keys tied to specific Supabase project
└─ Authentication flow breaks
```

**Impact of database migration:** ❌ ALL 89 edge functions become non-functional

---

## 2. CATEGORIZATION: WHICH FUNCTIONS BELONG WHERE?

### 2.1 Function Classification Matrix

| Function Type | Current Location | Size | Latency Requirement | Should Stay at Edge? | Better Location |
|---------------|------------------|------|-------------------|---------------------|-----------------|
| **Request Routing** | Edge | Small | <10ms | ✅ YES | Nginx / API Gateway |
| **API CRUD** | Edge (6) | Medium | <100ms | ❌ NO | Backend (Node.js) |
| **Auth/Rate Limiting** | Edge (4) | Small | <50ms | ⚠️ MAYBE | Backend + Nginx |
| **OAuth Callbacks** | Edge (15) | Small | <200ms | ✅ YES | Backend (easier integration) |
| **Webhooks** | Edge (20) | Small-Med | <500ms | ⚠️ MAYBE | Backend + Queue |
| **Heavy Computation** | Edge (12) | Large | <3000ms | ❌ NO | Lambda / Job Queue |
| **File Operations** | Edge (5) | Medium | <500ms | ❌ NO | Backend with streaming |
| **Data Sync/Integrations** | Edge (8) | Large | <5000ms | ❌ NO | Async Job Queue |
| **Utilities** | Edge (4) | Small | <100ms | ⚠️ MAYBE | Backend |

---

## 3. DETAILED ANALYSIS: SHOULD YOU KEEP EDGE FUNCTIONS?

### 3.1 Pros of Edge Functions (Current Setup)

✅ **Geographic Distribution:** Reduced latency for global users
✅ **Scalability:** Auto-scales with traffic (no infrastructure management)
✅ **Cost:** Pay-per-execution only
✅ **Isolation:** Each function is isolated (security boundary)
✅ **No Server Management:** Fully serverless

### 3.2 Cons of Edge Functions (Your Situation)

❌ **Supabase Dependency:** Tightly coupled to Supabase client
❌ **Cold Starts:** Functions can have 5-10s cold starts (worse with Deno)
❌ **Limited Runtime:** Only Deno/Node.js available (limited library support)
❌ **Statelessness:** No persistent connections to database (reconnect each call)
❌ **Complex Debugging:** Logs spread across Supabase dashboard
❌ **Difficult to Test Locally:** Requires Supabase CLI setup
❌ **Vendor Lock-in:** Specific to Supabase ecosystem
❌ **Database Migration Blocker:** Cannot work with self-hosted PostgreSQL without major refactoring

### 3.3 Reality Check: Edge Functions Are Overused Here

**Observation:** Many functions (API CRUD endpoints) don't benefit from edge deployment:
- API CRUD operations are <100ms - edge location doesn't matter much
- Better served from centralized backend (horizontal scaling easier)
- Easier to debug, test, monitor from backend
- Standard API patterns (Express, Fastify) more familiar to teams

**Decision:** Move 60-70 functions to backend, keep only truly critical ones at edge

---

## 4. RECOMMENDED ARCHITECTURE FOR DOCKER DEPLOYMENT

### 4.1 Three-Tier Function Deployment Model

```
REQUEST FLOW:

User Browser
    ↓
┌─────────────────────────────────────┐
│  TIER 1: EDGE LAYER (if scaling)    │
│  CloudFlare Workers or AWS@Edge     │
├─────────────────────────────────────┤
│ Functions:                          │
│ • Request routing                   │
│ • SSL termination (Nginx handles)   │
│ • Basic rate limiting               │
│ • CORS handling                     │
│ • Request logging/correlation ID    │
│ • Cache layer (API responses)       │
│                                     │
│ Effort: LOW (Nginx config only)     │
│ Replaces: 5-10 functions            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  TIER 2: BACKEND API (Docker)       │
│  Node.js/Express Service            │
├─────────────────────────────────────┤
│ API Endpoints:                      │
│ • api-v1-activities                 │
│ • api-v1-deals                      │
│ • api-v1-contacts                   │
│ • api-v1-companies                  │
│ • api-v1-tasks                      │
│ • api-v1-meetings                   │
│                                     │
│ OAuth Callbacks:                    │
│ • google-oauth-callback             │
│ • slack-oauth-callback              │
│ • fathom-oauth-callback             │
│                                     │
│ Webhooks:                           │
│ • fathom-webhook                    │
│ • savvycal-leads-webhook            │
│ • send-slack-message                │
│                                     │
│ Utilities:                          │
│ • api-copilot                       │
│ • api-proxy                         │
│ • enrich-company                    │
│ • fetch-company-logo                │
│                                     │
│ Effort: HIGH (Convert 50+ functions)│
│ Replaces: 50-60 functions           │
└─────────────────────────────────────┘
    ↓
PostgreSQL Database
    ↓
┌─────────────────────────────────────┐
│  TIER 3: ASYNC JOB QUEUE (Docker)   │
│  Bull Queue / BullMQ (on Redis)     │
├─────────────────────────────────────┤
│ Long-running Jobs:                  │
│ • generate-video-thumbnail          │
│ • generate-proposal (AI)            │
│ • fathom-sync (transcript processing)│
│ • bulk-import-activities            │
│ • calculate-deal-health             │
│ • extract-action-items              │
│ • process-single-activity           │
│                                     │
│ Scheduled Jobs (Cron):              │
│ • fathom-cron-sync                  │
│ • backfill-thumbnails               │
│ • reprocess-meetings-ai             │
│                                     │
│ Effort: MEDIUM (Create queue system)│
│ Replaces: 15-20 functions           │
└─────────────────────────────────────┘
```

### 4.2 Tier 1: Edge Functions (Keep Some, Minimize)

**Keep at Edge (if using CloudFlare or AWS@Edge):**
```
~5-10 functions total (from current 89)

1. Request routing / API Gateway
   - Route /api/* to backend
   - Route /assets/* to S3 CDN
   - Implement request correlation IDs

2. CORS handling
   - Enforce CORS policies
   - Handle preflight requests

3. Rate limiting (optional)
   - Per-IP basic rate limiting
   - Fallback to backend per-tenant limits

4. Caching layer (optional)
   - Cache GET endpoints
   - Invalidate on mutations

Implementation: Pure Nginx + CloudFlare rules
  (No custom functions needed for Docker setup)
```

**Option A: Keep Nginx Only (Recommended)**
- Standard Nginx reverse proxy handles routing
- No custom edge functions needed
- Simpler deployment, standard operations

**Option B: Add CloudFlare Workers (Advanced)**
- For global CDN + edge logic
- Caching and geolocation features
- Optional but useful for scale

### 4.3 Tier 2: Backend API Layer (Convert 50+ functions)

**Convert to Express/Fastify Backend:**

```typescript
// Current Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'),
                                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const { data } = await supabase.from('deals').select('*')
  return new Response(JSON.stringify(data))
})

// Refactored Backend Endpoint
app.get('/api/v1/deals', async (req, res, next) => {
  try {
    const userId = req.user.id // From JWT middleware
    const orgId = req.user.currentOrgId // From org context

    // Use standard database connection
    const deals = await db.query(
      'SELECT * FROM deals WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    )

    res.json({ data: deals })
  } catch (error) {
    next(error) // Error handler middleware
  }
})
```

**Conversion Benefits:**
- ✅ Uses standard Node.js (not Deno)
- ✅ Works with self-hosted PostgreSQL
- ✅ Easier local testing
- ✅ Better debugging (express-debug, etc.)
- ✅ Standard middleware (auth, logging, error handling)
- ✅ Connection pooling support
- ✅ Simpler deployment to Docker

**Functions to Convert (Priority Order):**

Priority 1 - API CRUD (6 functions):
```
✓ api-v1-activities → POST /api/v1/activities
✓ api-v1-deals      → POST /api/v1/deals
✓ api-v1-contacts   → POST /api/v1/contacts
✓ api-v1-companies  → POST /api/v1/companies
✓ api-v1-tasks      → POST /api/v1/tasks
✓ api-v1-meetings   → POST /api/v1/meetings
```

Priority 2 - OAuth Callbacks (8 functions):
```
✓ google-oauth-callback        → GET /auth/google/callback
✓ slack-oauth-callback         → GET /auth/slack/callback
✓ fathom-oauth-callback        → GET /auth/fathom/callback
✓ google-oauth-initiate        → GET /auth/google/initiate
✓ google-oauth-exchange        → POST /auth/google/exchange
✓ google-oauth-callback-public → GET /auth/google/callback-public
✓ fathom-oauth-initiate        → GET /auth/fathom/initiate
```

Priority 3 - Webhooks (10+ functions):
```
✓ fathom-webhook               → POST /webhook/fathom
✓ savvycal-leads-webhook       → POST /webhook/savvycal
✓ send-slack-message           → POST /slack/send-message
✓ send-slack-notification      → POST /slack/send-notification
✓ send-slack-task-notification → POST /slack/send-task-notification
```

Priority 4 - Utilities (15+ functions):
```
✓ api-copilot                  → POST /api/copilot
✓ enrich-company               → POST /api/enrich-company
✓ fetch-company-logo           → GET /api/company-logo
✓ create-api-key               → POST /api/api-keys
```

### 4.4 Tier 3: Async Job Queue (Convert 15-20 functions)

**Use Bull/BullMQ on Redis (in Docker):**

```typescript
// Current Edge Function (slow, blocks)
serve(async (req) => {
  const video = await downloadVideo(videoUrl)
  const thumbnail = await generateThumbnail(video) // 30-60s
  await supabase.from('meetings').update({thumbnail_url}).eq('id', meetingId)
  return new Response(JSON.stringify({status: 'done'}))
})

// Refactored with Job Queue
// API endpoint (fast)
app.post('/api/v1/meetings/:id/generate-thumbnail', async (req, res) => {
  const { id } = req.params

  // Queue the job (returns immediately)
  await thumbnailQueue.add({
    meetingId: id,
    videoUrl: req.body.videoUrl
  }, { priority: 10, attempts: 3 })

  res.json({ status: 'queued', jobId: job.id })
})

// Background worker (separate process)
thumbnailQueue.process(async (job) => {
  const { meetingId, videoUrl } = job.data

  try {
    const video = await downloadVideo(videoUrl)
    const thumbnail = await generateThumbnail(video)

    await db.query(
      'UPDATE meetings SET thumbnail_url = $1 WHERE id = $2',
      [thumbnail, meetingId]
    )

    // Update user via WebSocket/notification
    await sendNotification(meetingId, 'Thumbnail ready')

  } catch (error) {
    throw error // Will retry automatically
  }
})
```

**Functions to Move to Queue:**

Long-running operations (20+ functions):
```
generate-video-thumbnail        → Job queue
generate-video-thumbnail-v2     → Job queue
generate-proposal               → Job queue (AI)
generate-marketing-content      → Job queue (AI)
fathom-sync                     → Job queue
fathom-transcript-retry         → Job queue
bulk-import-activities          → Job queue
calculate-deal-health           → Job queue
extract-action-items            → Job queue (AI)
process-single-activity         → Job queue
reprocess-meetings-ai           → Job queue
backfill-thumbnails             → Job queue
backfill-transcripts            → Job queue

Scheduled jobs (Cron):
fathom-cron-sync                → Bull queue with cron schedule
```

**Implementation:**
```yaml
services:
  backend:
    depends_on: [redis]
    environment:
      REDIS_URL: redis://redis:6379
    services:
      - API server (port 3000)
      - 2-4 job workers

  redis:
    image: redis:7-alpine
    ports: [6379]
    volumes: [redis_data]
```

**Advantages:**
- ✅ Non-blocking responses
- ✅ Automatic retries (3x by default)
- ✅ Priority handling
- ✅ Failed job recovery
- ✅ Horizontal scaling (add workers)
- ✅ Progress tracking
- ✅ Dead-letter queue support
- ✅ Real-time job monitoring

---

## 5. MIGRATION STRATEGY: EDGE FUNCTIONS → DOCKER

### 5.1 Phase 1: Assessment (1 week)

```
├─ Inventory each function (already done)
├─ Categorize by tier (1/2/3)
├─ Estimate conversion effort per function
├─ Create dependency map (which functions call others)
├─ Identify timing-critical functions (need edge latency)
└─ Plan database connection strategy
```

### 5.2 Phase 2: Infrastructure Setup (1-2 weeks)

```
├─ Create Docker backend structure
│  ├─ Express/Fastify application skeleton
│  ├─ Database abstraction layer
│  ├─ Middleware (auth, logging, error handling)
│  ├─ Job queue setup (Bull on Redis)
│  └─ Monitoring/logging integration
│
├─ Set up Redis (for job queue + caching)
├─ Configure Nginx (request routing)
├─ Create docker-compose.yml with all services
└─ Test local development environment
```

### 5.3 Phase 3: Function Conversion (3-4 weeks)

**Priority 1: API CRUD (1 week)**
```
Convert api-v1-* functions to Express routes
├─ api-v1-activities
├─ api-v1-deals
├─ api-v1-contacts
├─ api-v1-companies
├─ api-v1-tasks
└─ api-v1-meetings

Test: Ensure all CRUD operations work with PostgreSQL
```

**Priority 2: OAuth & Auth (1 week)**
```
Convert auth-related functions
├─ google-oauth-callback, initiate, exchange
├─ slack-oauth-callback
├─ fathom-oauth-callback
├─ Auth middleware (JWT validation)
└─ Rate limiting middleware

Test: Complete OAuth flow for each provider
```

**Priority 3: Webhooks (1 week)**
```
Convert webhook handlers
├─ fathom-webhook
├─ savvycal-leads-webhook
├─ slack notification endpoints
├─ Request signing verification
└─ Error handling with retries

Test: Send test webhooks from each provider
```

**Priority 4: Queue-based Jobs (1 week)**
```
Convert long-running functions to Bull jobs
├─ generate-video-thumbnail
├─ generate-proposal (AI)
├─ fathom-sync
├─ bulk-import-activities
├─ AI-based content generation
└─ Scheduled sync jobs (cron)

Test: Submit jobs, monitor queue, verify completion
```

**Priority 5: Utilities (1 week)**
```
Convert helper functions
├─ api-copilot
├─ enrich-company
├─ fetch-company-logo
├─ create-api-key
└─ Other utilities

Test: Each utility returns expected results
```

### 5.4 Phase 4: Migration & Cutover (1 week)

```
├─ Parallel deployment (old + new simultaneously)
├─ Feature flags to gradually route to new backend
├─ Monitor for issues and performance
├─ Rollback plan ready (route back to Supabase)
├─ Data consistency checks
└─ Supabase edge functions decommissioned
```

### 5.5 Phase 5: Optimization (1 week)

```
├─ Performance tuning (connection pooling, caching)
├─ Monitoring/alerting setup
├─ Documentation of new architecture
├─ Team training on new deployment
└─ Cleanup (remove edge function code)
```

---

## 6. COMPARISON: EDGE FUNCTIONS VS BACKENDS

| Aspect | Supabase Edge | Backend (Docker) | AWS Lambda@Edge |
|--------|--------------|-----------------|-----------------|
| **Setup Time** | Fast (Supabase CLI) | Medium | Slow (IaC) |
| **Local Testing** | Difficult | Easy | Difficult |
| **Latency (p50)** | 100-300ms | 50-100ms (same region) | 10-50ms (global) |
| **Cold Starts** | 5-10s first call | 100-500ms (Node process) | 1-2s (Lambda) |
| **Scaling** | Automatic | Manual (HPA/Docker) | Automatic |
| **Cost/month** | Supabase tier ($25-100) | Container costs (~$20-50) | ~$0.60/million requests + compute |
| **Database Compatibility** | Supabase only | Any PostgreSQL | Any (via API) |
| **Debugging** | Supabase dashboard | Standard Node.js tools | CloudWatch logs |
| **Vendor Lock-in** | High | Low | High (AWS) |
| **Team Familiarity** | Medium (Deno) | High (Node.js) | Medium (Lambda) |
| **Multi-tenant Support** | Requires RLS + caching | Native in code | Possible but harder |

---

## 7. SPECIFIC RECOMMENDATION FOR YOUR CASE

### 7.1 Architecture Recommendation

**For Docker multi-tenant SaaS deployment:**

```
DO NOT use AWS Lambda@Edge initially
INSTEAD: Backend-first approach

Tier 1 (Edge): Nginx only - no custom code
├─ SSL termination
├─ Request routing
├─ Basic rate limiting
└─ Response caching (optional)

Tier 2 (Backend): Node.js/Express in Docker
├─ Convert 60+ functions from Supabase Edge
├─ Standard middleware stack
├─ Connection pooling to PostgreSQL
└─ Easy multi-tenant scoping

Tier 3 (Async): Bull job queue on Redis
├─ Convert 20+ long-running functions
├─ Scheduled tasks (cron)
├─ Progress tracking
└─ Automatic retries

Future: Can add CloudFlare Workers for caching only
```

### 7.2 Why NOT AWS Lambda@Edge (At Least Initially)

❌ **Why Lambda@Edge is Overkill:**
1. Most functions are <500ms duration (benefit of edge location is minimal)
2. Database calls latency dominates (10ms edge saves → 100ms+ DB call)
3. Complex to setup and maintain
4. Requires learning AWS ecosystem
5. Debugging is harder (CloudWatch, x-ray)
6. Cold starts actually worse than backend (1-2s vs 100ms)
7. Code sharing between Lambda@Edge and origin harder
8. Per-request cost adds up (0.60 per million requests)

✅ **When Lambda@Edge Makes Sense:**
- Heavy static content serving (CloudFront is better)
- Request routing based on geolocation
- Complex caching logic at edge
- Multi-region deployment with local compute
- After you've optimized backend first

### 7.3 Why Backend (Docker) is Better for You

✅ **Benefits:**
1. **Simplicity:** Standard Node.js, familiar patterns
2. **Testing:** Run locally easily, write unit tests
3. **Multi-tenancy:** Easy to add org_id filtering in middleware
4. **Database:** Direct PostgreSQL connection (no API layer)
5. **Observability:** Standard logging, monitoring tools
6. **Team:** Your team likely knows Node.js better than Lambda
7. **Cost:** ~$50-100/month for infrastructure
8. **Flexibility:** Not locked into Supabase ecosystem
9. **Performance:** Connection pooling, proper middleware stack

---

## 8. IMPLEMENTATION TEMPLATE

### 8.1 Backend Server Structure (Node.js)

```
src/
├─ server.ts              # Express/Fastify app setup
├─ middleware/
│  ├─ auth.ts            # JWT authentication
│  ├─ orgContext.ts      # Organization context (org_id)
│  ├─ rateLimit.ts       # Rate limiting
│  ├─ logging.ts         # Request/response logging
│  └─ errorHandler.ts    # Error handling
├─ routes/
│  ├─ api/
│  │  ├─ deals.ts        # Converted from api-v1-deals
│  │  ├─ contacts.ts     # Converted from api-v1-contacts
│  │  ├─ activities.ts   # Converted from api-v1-activities
│  │  ├─ tasks.ts        # Converted from api-v1-tasks
│  │  ├─ companies.ts    # Converted from api-v1-companies
│  │  └─ meetings.ts     # Converted from api-v1-meetings
│  ├─ auth/
│  │  ├─ google.ts       # Google OAuth callback
│  │  ├─ slack.ts        # Slack OAuth callback
│  │  └─ fathom.ts       # Fathom OAuth callback
│  ├─ webhook/
│  │  ├─ fathom.ts       # Fathom webhooks
│  │  ├─ savvycal.ts     # SavvyCal webhooks
│  │  └─ slack.ts        # Slack webhooks
│  └─ internal/
│     ├─ copilot.ts      # AI copilot
│     ├─ enrich.ts       # Data enrichment
│     └─ utils.ts        # Utilities
├─ services/
│  ├─ database/
│  │  ├─ connection.ts   # Pool management
│  │  └─ queries.ts      # SQL queries
│  ├─ external/
│  │  ├─ googleApi.ts    # Google API client
│  │  ├─ slackApi.ts     # Slack client
│  │  ├─ fathomApi.ts    # Fathom client
│  │  └─ aiProviders.ts  # AI provider wrappers
│  └─ queue/
│     ├─ jobQueue.ts     # Bull configuration
│     ├─ jobs/
│     │  ├─ thumbnail.job.ts
│     │  ├─ proposal.job.ts
│     │  ├─ sync.job.ts
│     │  └─ ai.job.ts
│     └─ workers.ts      # Job processors
├─ utils/
│  ├─ logger.ts
│  ├─ config.ts
│  └─ validation.ts
└─ types/
   └─ index.ts           # TypeScript types
```

### 8.2 Sample Conversion: API CRUD

**Before (Supabase Edge Function):**
```typescript
// supabase/functions/api-v1-deals/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', user_id)
    return new Response(JSON.stringify(data))
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { data } = await supabase
      .from('deals')
      .insert([{ ...body, user_id }])
    return new Response(JSON.stringify(data))
  }
})
```

**After (Backend Node.js):**
```typescript
// src/routes/api/deals.ts
import express, { Router } from 'express'
import { db } from '@/services/database'
import { authMiddleware } from '@/middleware/auth'
import { orgContextMiddleware } from '@/middleware/orgContext'

const router = Router()

// GET /api/v1/deals
router.get('/', authMiddleware, orgContextMiddleware, async (req, res, next) => {
  try {
    const { userId, orgId } = req.user
    const { limit = 50, offset = 0 } = req.query

    // Query respects multi-tenant org_id
    const deals = await db.query(
      `SELECT * FROM deals
       WHERE org_id = $1 AND user_id = $2
       LIMIT $3 OFFSET $4`,
      [orgId, userId, limit, offset]
    )

    res.json({ data: deals })
  } catch (error) {
    next(error)
  }
})

// POST /api/v1/deals
router.post('/', authMiddleware, orgContextMiddleware, async (req, res, next) => {
  try {
    const { userId, orgId } = req.user
    const { name, value, stage } = req.body

    // Validate input
    if (!name || !value) {
      return res.status(400).json({ error: 'Name and value required' })
    }

    const deal = await db.query(
      `INSERT INTO deals (org_id, user_id, name, value, stage)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, userId, name, value, stage || 'SQL']
    )

    res.status(201).json({ data: deal })
  } catch (error) {
    next(error)
  }
})

export default router
```

### 8.3 Sample Conversion: Long-Running Job

**Before (Supabase Edge Function - blocking):**
```typescript
// supabase/functions/generate-video-thumbnail-v2/index.ts
serve(async (req) => {
  const { videoUrl, meetingId } = await req.json()

  // This takes 30-60 seconds, blocks the request
  const video = await downloadVideo(videoUrl)
  const thumbnail = await runHeadlessBrowser(video) // Time out risk

  await supabase
    .from('meetings')
    .update({ thumbnail_url: thumbnail })
    .eq('id', meetingId)

  return new Response(JSON.stringify({ status: 'done' }))
})
```

**After (Backend with Job Queue):**
```typescript
// src/routes/api/meetings.ts
router.post('/:id/generate-thumbnail', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { videoUrl } = req.body

  // Queue the job (returns immediately)
  const job = await thumbnailQueue.add(
    { meetingId: id, videoUrl },
    {
      priority: 10,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  )

  res.json({ jobId: job.id, status: 'queued' })
})

// src/services/queue/jobs/thumbnail.job.ts
export async function processThumbnailJob(job: Job) {
  const { meetingId, videoUrl } = job.data

  try {
    // Download video
    const video = await downloadVideo(videoUrl)

    // Generate thumbnail (30-60s)
    const thumbnail = await runHeadlessBrowser(video)

    // Update database
    await db.query(
      'UPDATE meetings SET thumbnail_url = $1 WHERE id = $2',
      [thumbnail, meetingId]
    )

    // Notify user (WebSocket, notification, email)
    await notificationService.notify(meetingId, 'Thumbnail generated')

    return { status: 'completed', thumbnail }
  } catch (error) {
    logger.error('Thumbnail generation failed', { meetingId, error })
    throw error // Will retry automatically
  }
}

// src/services/queue/workers.ts
export function startThumbnailWorker() {
  thumbnailQueue.process(
    4, // 4 concurrent jobs
    processThumbnailJob
  )

  thumbnailQueue.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id })
  })

  thumbnailQueue.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job.id, error: err.message })
  })
}
```

---

## 9. COST ANALYSIS: CURRENT VS PROPOSED

### 9.1 Current Setup (Supabase Edge Functions)

```
Supabase Pricing:
├─ Base: $25/month (Free tier)
├─ Compute: Pay-per-request ($0.00001 per function invocation)
└─ Database: Included in tier

For 100,000 requests/day:
├─ Daily: 100,000 requests
├─ Monthly: 3,000,000 requests
├─ Cost: 3,000,000 × $0.00001 = $30/month (functions)
├─ Plus: $25 base = $55/month total
└─ Plus: Bandwidth costs (variable)

Total: ~$55-150/month (single tenant)
Scales poorly: Each customer = separate Supabase project
```

### 9.2 Proposed Setup (Docker on Railway/AWS)

```
Railway (Recommended for MVP):
├─ Backend Service (2GB RAM): $7/month
├─ Worker Service (1GB RAM): $3.50/month
├─ PostgreSQL (db.t4g.micro): $0/month free tier
├─ Redis (512MB): $5/month
└─ Total: ~$15.50/month base

With 100 customers:
├─ Shared infrastructure: $15.50/month
├─ Per-customer share: $0.15/month
├─ Customer capacity: 1000+ concurrent users per instance
└─ Total multi-tenant cost: ~$15-20/month for 100 customers

Cost per customer: $0.15-0.20/month (99% savings!)

Scaling:
├─ If 1000 customers: ~$50-100/month (~$0.05/customer)
└─ If 10,000 customers: ~$500-1000/month (~$0.05-0.10/customer)

AWS (for enterprise):
├─ Load balancer: $16/month
├─ RDS PostgreSQL (db.t4g.large): $132/month
├─ ElastiCache Redis: $14/month
├─ ECS Fargate: $0.01/vCPU-hour
├─ Per customer compute: ~$20/month
└─ Total: ~$180/month base + $20/customer

Cost per customer: ~$20-50/month on AWS
```

### 9.3 Cost Comparison Table

| Setup | Monthly Cost | Per Customer (100 customers) | Scalability |
|-------|-------------|---------------------------|------------|
| **Current (Supabase)** | $55-150/month single | $55-150 (1:1) | Poor (separate projects) |
| **Proposed (Railway)** | $15-20/month shared | $0.15-0.20 | Excellent (10K+ customers) |
| **AWS ECS** | $180/month base | $2-5/customer | Very good (enterprise) |
| **AWS Lambda@Edge** | $0.60/M requests | $2-10/customer | Good but complex |

**Conclusion:** Docker on Railway is 100-250x cheaper per customer at scale

---

## 10. MIGRATION CHECKLIST

### Phase-by-Phase Execution

**Week 1: Planning & Assessment**
- [ ] Audit all 89 functions (categorize by tier)
- [ ] Create detailed dependency map
- [ ] Estimate effort per function
- [ ] Design backend API routes
- [ ] Plan database abstraction layer
- [ ] Choose deployment (Railway vs AWS)

**Week 2: Infrastructure**
- [ ] Set up Docker environment locally
- [ ] Create Express/Fastify skeleton
- [ ] Set up PostgreSQL (local development)
- [ ] Set up Redis for job queue
- [ ] Create docker-compose.yml
- [ ] Test local environment

**Weeks 3-6: Function Conversion**
- [ ] Week 3: API CRUD endpoints (6 functions)
- [ ] Week 4: Auth & OAuth callbacks (8 functions)
- [ ] Week 5: Webhooks (10+ functions)
- [ ] Week 6: Job queue setup & conversion (20+ functions)

**Week 7: Integration & Testing**
- [ ] Connect frontend to new backend
- [ ] Run full integration tests
- [ ] Performance benchmarking
- [ ] Load testing
- [ ] Security testing

**Week 8: Deployment**
- [ ] Deploy to Railway/AWS
- [ ] Run parallel deployment (old + new)
- [ ] Feature flags for gradual rollout
- [ ] Monitor for issues
- [ ] Decommission old edge functions

**Week 9: Optimization & Cleanup**
- [ ] Performance tuning
- [ ] Monitoring setup
- [ ] Documentation
- [ ] Team training
- [ ] Remove old code

---

## 11. FINAL RECOMMENDATION SUMMARY

### Do You Need AWS Lambda@Edge?

**Short Answer: NO** (at least not initially)

**Reasons:**
1. Cost: 100x more expensive than Docker backend
2. Complexity: Overkill for your use case
3. Cold starts: Actually slower than backend for most operations
4. Database: Still need backend for database connectivity
5. Multi-tenancy: Easier to implement in backend
6. Team: Node.js easier than Lambda ecosystem

### What Should You Do?

**Recommended Path (Priority Order):**

```
1. Tier 2 First (Backend):
   ├─ Convert Supabase Edge Functions → Node.js/Express
   ├─ Deploy in Docker containers
   ├─ Use standard database connections
   ├─ Add multi-tenant scoping in middleware
   └─ Gain 10x performance improvement

2. Tier 3 Next (Job Queue):
   ├─ Add Bull/BullMQ for long-running tasks
   ├─ Move generate/process/sync jobs to queue
   ├─ Non-blocking API responses
   └─ Automatic retry + monitoring

3. Tier 1 Last (if needed):
   ├─ Add CloudFlare Workers for caching only
   ├─ Or use Nginx reverse proxy (simpler)
   ├─ Optional for global distribution
   └─ Implement only after optimizing backend
```

### Expected Outcomes

**After Migration:**
- ✅ Faster API responses (50-100ms vs 300-500ms)
- ✅ Non-blocking long operations (job queue)
- ✅ 100x cheaper per customer (multi-tenant)
- ✅ Much easier to debug and maintain
- ✅ Standard Node.js ecosystem (team familiar)
- ✅ Support for self-hosted PostgreSQL
- ✅ Multi-tenant isolation in code
- ✅ Horizontal scaling (add containers)
- ✅ Better monitoring and observability

**Timeline:** 6-8 weeks to complete migration

---

## APPENDIX: Edge Functions → Backend Conversion Checklists

### Quick Tier Decision Matrix

For each of your 89 functions, ask:

```
Is it doing database operations? YES → Tier 2 (Backend)
Is it < 100ms? YES → Tier 1 (Edge) or Tier 2 (either works)
Is it > 5 seconds? YES → Tier 3 (Job Queue)
Is it a webhook receiver? YES → Tier 2 (Backend)
Is it OAuth callback? YES → Tier 2 (Backend)
Is it static caching? YES → Tier 1 (Edge)
Does it call external APIs? YES → Tier 2 (Backend)
Is it heavy computation (ML/AI)? YES → Tier 3 (Job Queue)
Does it need millisecond latency? YES → Tier 1 (Edge)
```

### Functions by Tier (Updated)

**TIER 1 (Keep at Edge): ~5-10 functions**
- Nothing (use Nginx instead)

**TIER 2 (Move to Backend): ~60 functions**
- All API CRUD (6)
- All OAuth callbacks (8)
- All webhooks (15+)
- All utilities (15+)
- All integrations (15+)

**TIER 3 (Move to Job Queue): ~15 functions**
- All thumbnail/video generation
- All AI/content generation
- All bulk imports/syncs
- All heavy processing

**TOTAL CONVERSIONS NEEDED: 89 → 0 edge functions + backend + queue**

---

**Conclusion:** Backend-first approach on Docker is the optimal path forward. It's simpler, cheaper, more maintainable, and provides better multi-tenant support than keeping edge functions or using Lambda@Edge.

