# Deployment Guide - Email Sync & Health Score Automation

This guide covers deploying the new Supabase edge functions and running required migrations.

## 📋 Prerequisites

1. **Supabase CLI** installed and authenticated
   ```bash
   npm install -g supabase
   supabase login
   ```

2. **Project linked** to your Supabase project
   ```bash
   supabase link --project-ref your-project-ref
   ```

## 🗄️ Database Migrations

Run these migrations in order (they will run automatically if using `supabase db push`):

### Required Migrations (New)

1. **`20251123000001_enhance_communication_events.sql`**
   - Adds email-specific fields to `communication_events` table
   - Adds AI analysis columns (sentiment, topics, action items, urgency)
   - Creates indexes for email lookups

2. **`20251123000002_add_last_login_tracking.sql`**
   - Adds `last_login_at` column to `profiles` table
   - Creates trigger to auto-update on user login
   - Required for scheduled jobs to identify active users

3. **`20251123000003_health_score_performance_indexes.sql`**
   - Creates performance indexes for health score queries
   - Optimizes email sentiment lookups
   - Improves deal and relationship health query performance

### Migration Commands

```bash
# Option 1: Push all migrations (recommended)
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase db push

# Option 2: Run migrations manually via Supabase Dashboard
# Go to: Database → Migrations → Run migration files
```

## 🚀 Deploy Edge Functions

### Deploy New Functions

```bash
# Deploy scheduled-health-refresh
supabase functions deploy scheduled-health-refresh

# Deploy scheduled-email-sync
supabase functions deploy scheduled-email-sync
```

### Deploy All Functions (if needed)

```bash
# Deploy all functions
supabase functions deploy
```

### Verify Deployment

```bash
# List deployed functions
supabase functions list
```

## 🔐 Environment Variables

Set these environment variables in Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**

2. Add/Verify these secrets:

   **Required:**
   - `CRON_SECRET` - Secure random string for cron authentication
     ```bash
     # Generate with:
     openssl rand -hex 32
     ```
   
   - `ANTHROPIC_API_KEY` - For email AI analysis (Claude Haiku 4.5)
     - Get from: https://console.anthropic.com/
   
   **Already Set (verify these exist):**
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for RLS bypass)

### Set Secrets via CLI

```bash
# Set CRON_SECRET
supabase secrets set CRON_SECRET=your-generated-secret-here

# Set ANTHROPIC_API_KEY (if not already set)
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
```

## ✅ Verification Steps

### 1. Verify Migrations

```sql
-- Check communication_events table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'communication_events' 
  AND column_name IN ('ai_analyzed', 'sentiment_score', 'key_topics', 'email_thread_id');

-- Check profiles table has last_login_at
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'last_login_at';

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'communication_events' 
  AND indexname LIKE 'idx_communication_events%';
```

### 2. Test Edge Functions

```bash
# Test health refresh function
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://YOUR_PROJECT.supabase.co/functions/v1/scheduled-health-refresh"

# Test email sync function
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://YOUR_PROJECT.supabase.co/functions/v1/scheduled-email-sync"
```

### 3. Check Function Logs

```bash
# View logs for scheduled-health-refresh
supabase functions logs scheduled-health-refresh

# View logs for scheduled-email-sync
supabase functions logs scheduled-email-sync
```

## 📝 Migration Checklist

- [ ] Run migration `20251123000001_enhance_communication_events.sql`
- [ ] Run migration `20251123000002_add_last_login_tracking.sql`
- [ ] Run migration `20251123000003_health_score_performance_indexes.sql`
- [ ] Verify all columns and indexes created successfully
- [ ] Deploy `scheduled-health-refresh` edge function
- [ ] Deploy `scheduled-email-sync` edge function
- [ ] Set `CRON_SECRET` environment variable
- [ ] Set `ANTHROPIC_API_KEY` environment variable (if not already set)
- [ ] Test edge functions manually
- [ ] Verify Vercel cron jobs are configured (see VERCEL_CRON_SETUP.md)

## 🔄 Post-Deployment

After deployment:

1. **Monitor First Cron Execution**
   - Check Vercel cron job logs
   - Check Supabase edge function logs
   - Verify health scores are being refreshed

2. **Verify Email Sync**
   - Check that emails are being synced for active users
   - Verify AI analysis is working
   - Check `communication_events` table for new entries

3. **Performance Monitoring**
   - Monitor query performance with new indexes
   - Check edge function execution times
   - Review error rates

## 🐛 Troubleshooting

### Migration Errors

```sql
-- If migration fails, check for existing columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'communication_events';

-- Drop and recreate if needed (BE CAREFUL - backup first!)
```

### Edge Function Errors

```bash
# Check function logs
supabase functions logs scheduled-health-refresh --tail

# Verify environment variables
supabase secrets list
```

### Common Issues

1. **"Missing Supabase configuration"**
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

2. **"Unauthorized" errors**
   - Check `CRON_SECRET` matches in both Vercel and Supabase

3. **"ANTHROPIC_API_KEY not configured"**
   - Set the API key in Supabase secrets

## 📚 Related Documentation

- [Vercel Cron Setup](./VERCEL_CRON_SETUP.md) - Vercel cron job configuration
- [Email Sync Plan](./.cursor/plans/sentiment-785ab6fa.plan.md) - Original implementation plan

---

**Last Updated**: November 23, 2025
**Version**: 1.0




































