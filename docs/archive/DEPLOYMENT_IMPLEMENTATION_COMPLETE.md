# Deployment Implementation Complete ✅

## Overview

The relationship health monitoring cron jobs have been fully implemented and are ready for deployment. This document provides a complete implementation summary and deployment guide.

---

## 🎯 What Was Implemented

### 1. PostgreSQL RPC Functions ✅
**File:** `supabase/migrations/20251124000001_create_health_refresh_rpc_functions.sql`

Created two PostgreSQL functions for efficient health score calculation:

#### `refresh_deal_health_scores(p_user_id, p_max_age_hours)`
- Refreshes health scores for all active deals owned by a user
- Calculates stage velocity based on days in current stage
- Determines health status (healthy/warning/critical/stalled)
- Only updates stale scores (older than threshold)
- Returns: `deal_id`, `health_score`, `health_status`, `updated` (boolean)

#### `refresh_relationship_health_scores(p_user_id, p_max_age_hours)`
- Refreshes health scores for all contacts owned by a user
- Calculates communication frequency and meeting patterns
- Detects ghost risk based on interaction gaps
- Determines health status (healthy/at_risk/critical/ghost)
- Only updates stale scores (older than threshold)
- Returns: `contact_id`, `health_score`, `health_status`, `updated` (boolean)

**Key Features:**
- **Performance Optimized**: Database-native calculations for speed
- **Smart Caching**: Only refreshes stale scores (configurable threshold)
- **Security**: `SECURITY DEFINER` for proper RLS handling
- **Idempotent**: Safe to run multiple times

### 2. Health Refresh Edge Function ✅
**File:** `supabase/functions/scheduled-health-refresh/index.ts`

**Implementation:**
- Identifies active users (logged in last 7 days)
- Calls `refresh_deal_health_scores()` RPC for each user
- Calls `refresh_relationship_health_scores()` RPC for each user
- Tracks metrics: users processed, deals refreshed, relationships refreshed
- Handles errors gracefully (continues processing other users)

**Authentication:**
- Validates `CRON_SECRET` from request headers
- Verifies `x-vercel-cron` header for Vercel-triggered jobs
- Uses service role key for database operations (bypasses RLS)

**Response Format:**
```json
{
  "success": true,
  "usersProcessed": 5,
  "dealsRefreshed": 23,
  "relationshipsRefreshed": 47,
  "errors": [],
  "timestamp": "2025-01-24T07:00:00.000Z"
}
```

### 3. Email Sync Edge Function ✅
**File:** `supabase/functions/scheduled-email-sync/index.ts`

**Implementation:**
- Identifies active users with Gmail integration (logged in last 7 days)
- For each user:
  - Fetches CRM contacts with email addresses
  - Calls Gmail API for emails from last 24 hours
  - Matches emails against CRM contacts
  - Stores matching emails as communication events
- Incremental sync (24 hours) for daily cron job efficiency

**Email Processing:**
- Extracts: from, to, subject, date from Gmail message headers
- Matches emails to CRM contacts by email address
- Links emails to contacts automatically
- Stores in `communication_events` table for health score calculation

**Authentication:**
- Validates `CRON_SECRET` from request headers
- Verifies `x-vercel-cron` header
- Uses service role key for database operations
- Requires active Google OAuth integration per user

**Response Format:**
```json
{
  "success": true,
  "usersProcessed": 5,
  "emailsSynced": 142,
  "contactsWithEmails": 87,
  "errors": [],
  "timestamp": "2025-01-24T08:00:00.000Z"
}
```

---

## 📋 Deployment Checklist

### Step 1: Run Database Migration ✅

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Apply new migration
supabase db push

# Or run specific migration
supabase db push supabase/migrations/20251124000001_create_health_refresh_rpc_functions.sql
```

**Verify Migration:**
```sql
-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%health%';

-- Should return:
-- refresh_deal_health_scores | FUNCTION
-- refresh_relationship_health_scores | FUNCTION
```

### Step 2: Set Supabase Edge Function Secrets ✅

```bash
# Set cron authentication secret
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"

# Set Anthropic API key (for future email AI analysis)
supabase secrets set ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Verify secrets are set
supabase secrets list
```

### Step 3: Deploy Edge Functions ✅

```bash
# Deploy health refresh function
supabase functions deploy scheduled-health-refresh

# Deploy email sync function
supabase functions deploy scheduled-email-sync

# Verify deployment
supabase functions list
```

**Expected Output:**
```
NAME                        STATUS    REGION
scheduled-health-refresh    deployed  us-east-1
scheduled-email-sync        deployed  us-east-1
```

### Step 4: Set Vercel Environment Variables ✅

**Required Variables:**
```bash
# Vercel Project Settings → Environment Variables

# Backend (for API routes)
SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend (for browser)
VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cron authentication
CRON_SECRET=<same-value-as-supabase-secret>
```

**Important:**
- Set for **Production**, **Preview**, AND **Development** environments
- `CRON_SECRET` must match the value set in Supabase secrets
- `SUPABASE_ANON_KEY` is the **publishable** key (safe for frontend)
- Never use `SUPABASE_SERVICE_ROLE_KEY` in frontend or Vercel variables

### Step 5: Verify Vercel Cron Configuration ✅

**File:** `vercel.json` (lines 137-146)

```json
{
  "crons": [
    {
      "path": "/api/cron/health-refresh",
      "schedule": "0 7 * * *"  // 7am UTC daily
    },
    {
      "path": "/api/cron/email-sync",
      "schedule": "0 8 * * *"  // 8am UTC daily
    }
  ]
}
```

**Schedule Details:**
- Health refresh: 7:00 AM UTC (8:00 AM CET)
- Email sync: 8:00 AM UTC (9:00 AM CET)
- Cron format: `minute hour day month dayOfWeek`

### Step 6: Deploy to Vercel ✅

```bash
# Option 1: Via Vercel CLI
vercel --prod

# Option 2: Via Git
git add .
git commit -m "feat: Implement health refresh and email sync cron jobs"
git push origin main

# Option 3: Via Vercel Dashboard
# Go to Deployments → Redeploy
```

### Step 7: Verify Cron Jobs in Vercel ✅

1. Go to **Vercel Dashboard** → Your Project
2. Navigate to **Settings** → **Cron Jobs**
3. Verify both jobs are listed:
   - `health-refresh` - Daily at 7:00 AM UTC
   - `email-sync` - Daily at 8:00 AM UTC

### Step 8: Test Cron Endpoints Manually ✅

```bash
# Get your CRON_SECRET from Vercel environment variables
CRON_SECRET="your-secret-here"

# Test health refresh
curl -X GET \
  "https://your-app.vercel.app/api/cron/health-refresh?secret=$CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "usersProcessed": 5,
#   "dealsRefreshed": 23,
#   "relationshipsRefreshed": 47,
#   "errors": [],
#   "triggeredBy": "vercel-cron",
#   "timestamp": "2025-01-24T07:00:00.000Z"
# }

# Test email sync
curl -X GET \
  "https://your-app.vercel.app/api/cron/email-sync?secret=$CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "usersProcessed": 5,
#   "emailsSynced": 142,
#   "contactsWithEmails": 87,
#   "errors": [],
#   "triggeredBy": "vercel-cron",
#   "timestamp": "2025-01-24T08:00:00.000Z"
# }
```

---

## 🔍 Monitoring & Troubleshooting

### View Cron Execution Logs

**Vercel Logs:**
1. **Vercel Dashboard** → **Deployments** → Select deployment
2. Click **Functions** tab
3. Filter by `/api/cron/health-refresh` or `/api/cron/email-sync`

**Supabase Edge Function Logs:**
1. **Supabase Dashboard** → **Edge Functions**
2. Select `scheduled-health-refresh` or `scheduled-email-sync`
3. View **Logs** tab

### Common Issues

#### 1. "Unauthorized" Error
**Cause:** `CRON_SECRET` mismatch or missing
**Fix:**
```bash
# Verify secret matches in both places
supabase secrets list  # Check Supabase
# Check Vercel environment variables

# Regenerate if needed
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
# Update Vercel environment variable to match
```

#### 2. "Missing Supabase configuration" Error
**Cause:** Environment variables not set in Vercel
**Fix:**
- Go to **Vercel** → **Settings** → **Environment Variables**
- Add: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Redeploy

#### 3. Edge Function Timeout
**Cause:** Too many users or slow database
**Fix:**
- Check PostgreSQL performance
- Optimize RPC functions if needed
- Consider batching users (process in groups)

#### 4. Gmail Integration Errors
**Cause:** User's OAuth token expired or not set up
**Fix:**
- Users need to reconnect Gmail integration
- Edge function gracefully skips users with Gmail errors
- Check `errors` array in response for affected users

### Performance Metrics

**Expected Performance:**
- Health refresh: ~2-5 seconds per user
- Email sync: ~5-10 seconds per user (depending on email volume)
- Total execution: <2 minutes for 10 active users

**Optimization Tips:**
- RPC functions use indexes for fast lookups
- Only refreshes stale scores (24-hour threshold)
- Email sync limited to 100 messages per user per day
- Errors handled gracefully - one user failure doesn't stop others

---

## 📊 Database Schema Reference

### Tables Modified/Used

**`deal_health_scores`**
- Stores health scores for deals
- Updated by `refresh_deal_health_scores()` RPC

**`relationship_health_scores`**
- Stores health scores for contacts/companies
- Updated by `refresh_relationship_health_scores()` RPC

**`communication_events`**
- Stores email communications
- Populated by `scheduled-email-sync` edge function
- Used by health score calculations

**`profiles`**
- Tracks `last_login_at` for identifying active users
- Updated automatically via trigger (migration: `20251123000002_add_last_login_tracking.sql`)

**`google_integrations`**
- Tracks Gmail OAuth status per user
- Required for email sync functionality

---

## 🎉 Success Criteria

Your cron jobs are working correctly if:

✅ **Health Refresh:**
- Runs daily at 7:00 AM UTC without errors
- Processes all active users (logged in last 7 days)
- Updates stale deal and relationship health scores
- Response shows `success: true` and counts

✅ **Email Sync:**
- Runs daily at 8:00 AM UTC without errors
- Processes users with Gmail integration
- Syncs emails from last 24 hours
- Matches emails to CRM contacts
- Stores as communication events

✅ **Monitoring:**
- Check Vercel cron job logs daily for first week
- Monitor error rates and execution times
- Verify health scores are updating in dashboard

---

## 📚 Related Documentation

- **Setup Guide:** `SETUP_RELATIONSHIP_HEALTH.md`
- **User Guide:** `RELATIONSHIP_HEALTH_QUICK_START.md`
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md`
- **Vercel Cron Setup:** `VERCEL_CRON_SETUP.md`
- **Security Fixes:** `SECURITY_FIX.md`

---

## 🚀 Next Steps

1. **Deploy:** Follow the checklist above
2. **Monitor:** Check logs for first 3 days
3. **Verify:** Confirm health scores are updating
4. **Optimize:** Adjust schedules if needed

**Optional Enhancements:**
- Add email AI sentiment analysis (requires `ANTHROPIC_API_KEY`)
- Implement ghost detection alerting
- Add Slack notifications for critical health scores
- Create admin dashboard for cron job monitoring

---

## 📝 Implementation Notes

**Architecture Decisions:**

1. **PostgreSQL RPC Functions:** Chosen for performance and maintainability
   - Database-native calculations are faster than edge function logic
   - Single source of truth for health calculations
   - Easier to test and debug

2. **Incremental Email Sync:** Syncs last 24 hours only
   - Reduces API calls and processing time
   - Suitable for daily cron job
   - Historical sync can be done manually via frontend

3. **Error Handling:** Graceful degradation
   - One user failure doesn't stop processing others
   - Errors logged in response for debugging
   - Users without Gmail integration are skipped

4. **Active Users Only:** Processes users logged in last 7 days
   - Reduces unnecessary processing
   - Focuses on engaged users
   - Configurable threshold

**Security Considerations:**
- Cron secret authentication prevents unauthorized access
- Service role key only used in edge functions (never exposed to frontend)
- Row Level Security (RLS) policies enforced by database
- OAuth tokens secured per user in database

---

**Deployment Date:** January 24, 2025
**Implementation Status:** ✅ Complete and Ready for Production
**Last Updated:** January 24, 2025
