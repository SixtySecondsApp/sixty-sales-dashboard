# Deployment Summary - Email Sync & Health Score Automation

## ✅ Edge Functions Deployed

Both new edge functions have been successfully deployed:

1. **`scheduled-health-refresh`** ✅ DEPLOYED
   - Refreshes health scores for active users (logged in last 7 days)
   - Called daily via Vercel cron at 7:00 AM UTC
   - URL: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-health-refresh`

2. **`scheduled-email-sync`** ✅ DEPLOYED
   - Syncs emails for active users with Gmail integration
   - Called daily via Vercel cron at 8:00 AM UTC
   - URL: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-email-sync`

## 📋 Migrations Required

Run these **3 migrations** in order:

### 1. `20251123000001_enhance_communication_events.sql`
**Purpose**: Adds email-specific fields and AI analysis columns to `communication_events` table

**What it does**:
- Adds columns: `email_thread_id`, `email_subject`, `email_body_preview`, `response_time_hours`
- Adds AI analysis columns: `sentiment_score`, `ai_analyzed`, `ai_model`, `key_topics`, `action_items`, `urgency`, `response_required`
- Adds `external_id` and `sync_source` for Gmail integration
- Adds `communication_date` column (alias for `event_timestamp`)
- Creates indexes for email lookups and deduplication

**Run command**:
```bash
supabase db push
# OR manually in Supabase Dashboard → SQL Editor
```

### 2. `20251123000002_add_last_login_tracking.sql`
**Purpose**: Tracks user last login for automated health refresh scheduling

**What it does**:
- Adds `last_login_at` column to `profiles` table
- Creates trigger to auto-update `last_login_at` when user signs in
- Backfills existing users with their `last_sign_in_at` from `auth.users`
- Creates index for efficient queries

**Run command**:
```bash
supabase db push
# OR manually in Supabase Dashboard → SQL Editor
```

### 3. `20251123000003_health_score_performance_indexes.sql`
**Purpose**: Creates performance indexes for fast health score queries

**What it does**:
- Creates indexes on `deal_health_scores` (user, status, last_calculated_at)
- Creates indexes on `relationship_health_scores` (user, status, ghost_risk)
- Creates indexes on `communication_events` (deal, contact, company, sentiment)
- Creates indexes on `contacts`, `deals`, and `meetings` for health calculations

**Run command**:
```bash
supabase db push
# OR manually in Supabase Dashboard → SQL Editor
```

## 🚀 Quick Deploy Commands

### Deploy All Migrations
```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase db push
```

### Verify Migrations Applied
```sql
-- Check communication_events has new columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'communication_events' 
  AND column_name IN ('ai_analyzed', 'sentiment_score', 'key_topics', 'email_thread_id');

-- Check profiles has last_login_at
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'last_login_at';

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('communication_events', 'deal_health_scores', 'relationship_health_scores')
  AND indexname LIKE 'idx_%';
```

## 🔐 Environment Variables Needed

Set these in **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**:

### Required:
- `CRON_SECRET` - Secure random string (generate with: `openssl rand -hex 32`)
- `ANTHROPIC_API_KEY` - For email AI analysis (get from https://console.anthropic.com/)

### Already Set (verify):
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

### Set via CLI:
```bash
supabase secrets set CRON_SECRET=your-generated-secret-here
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
```

## ✅ Verification Checklist

- [x] Edge function `scheduled-health-refresh` deployed
- [x] Edge function `scheduled-email-sync` deployed
- [ ] Migration `20251123000001_enhance_communication_events.sql` applied
- [ ] Migration `20251123000002_add_last_login_tracking.sql` applied
- [ ] Migration `20251123000003_health_score_performance_indexes.sql` applied
- [ ] `CRON_SECRET` environment variable set
- [ ] `ANTHROPIC_API_KEY` environment variable set (if using email AI)
- [ ] Vercel cron jobs configured (see `VERCEL_CRON_SETUP.md`)

## 🧪 Test Functions

```bash
# Test health refresh
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-health-refresh"

# Test email sync
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-email-sync"
```

## 📊 Next Steps

1. **Run Migrations**: Execute the 3 SQL migration files in order
2. **Set Environment Variables**: Add `CRON_SECRET` and `ANTHROPIC_API_KEY` to Supabase
3. **Configure Vercel**: Set up cron jobs in Vercel (see `VERCEL_CRON_SETUP.md`)
4. **Test**: Manually trigger functions to verify they work
5. **Monitor**: Check logs after first scheduled run

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [Vercel Cron Setup](./VERCEL_CRON_SETUP.md) - Vercel cron job configuration
- [Email Sync Plan](./.cursor/plans/sentiment-785ab6fa.plan.md) - Original implementation plan

---

**Deployment Date**: November 23, 2025
**Status**: Edge Functions Deployed ✅ | Migrations Pending ⏳
