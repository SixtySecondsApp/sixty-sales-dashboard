# Vercel Cron Jobs Setup Guide

This guide explains how to set up scheduled cron jobs in Vercel for automated health score refresh and email sync.

## Overview

The application uses Vercel Cron Jobs to automatically:
1. **Refresh Health Scores** - Daily at 7:00 AM UTC
2. **Sync Emails** - Daily at 8:00 AM UTC

## Setup Steps

### 1. Environment Variables

Add the following environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

#### Required Variables:
- `CRON_SECRET` - A secure random string used to authenticate cron job requests
  - Generate with: `openssl rand -hex 32`
  - Or use any secure random string (minimum 32 characters)
  
- `SUPABASE_URL` - Your Supabase project URL
  - Format: `https://your-project.supabase.co`
  - Already set if you have `VITE_SUPABASE_URL`
  
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
  - Found in Supabase Dashboard → Settings → API
  - **Important**: This is different from the anon key
  - Used to bypass RLS for scheduled jobs

#### Optional (if not already set):
- `VITE_SUPABASE_URL` - Your Supabase project URL (for frontend)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key (for frontend)
- `ANTHROPIC_API_KEY` - For email AI analysis (if using Claude)

### 2. Deploy to Vercel

After adding environment variables, deploy your application:

```bash
# If using Vercel CLI
vercel --prod

# Or push to your main branch (if auto-deploy is enabled)
git push origin main
```

### 3. Verify Cron Jobs

After deployment, verify cron jobs are configured:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Cron Jobs**
3. You should see two cron jobs:
   - `health-refresh` - Runs daily at 7:00 AM UTC
   - `email-sync` - Runs daily at 8:00 AM UTC

### 4. Test Cron Jobs Manually

You can manually trigger cron jobs for testing:

#### Option 1: Via Vercel Dashboard
1. Go to **Settings** → **Cron Jobs**
2. Click on a cron job
3. Click **"Run Now"** button

#### Option 2: Via API (with secret)
```bash
# Health refresh
curl -X GET "https://your-app.vercel.app/api/cron/health-refresh?secret=YOUR_CRON_SECRET"

# Email sync
curl -X GET "https://your-app.vercel.app/api/cron/email-sync?secret=YOUR_CRON_SECRET"
```

#### Option 3: Via Vercel CLI
```bash
vercel cron run health-refresh
vercel cron run email-sync
```

## Cron Schedule

The cron jobs use standard cron syntax:

- `0 7 * * *` - Daily at 7:00 AM UTC (Health Refresh)
- `0 8 * * *` - Daily at 8:00 AM UTC (Email Sync)

### Timezone Notes

- Vercel cron jobs run in UTC
- 7:00 AM UTC = 8:00 AM CET (Central European Time)
- Adjust the schedule in `vercel.json` if you need a different time

## How It Works

1. **Vercel Cron** triggers the API route at the scheduled time
2. **API Route** (`/api/cron/health-refresh` or `/api/cron/email-sync`) verifies the request
3. **API Route** calls the Supabase Edge Function with service role authentication
4. **Edge Function** performs the actual work (refreshing health scores or syncing emails)

## Security

- Cron jobs are protected by:
  1. Vercel's built-in cron authentication (`x-vercel-cron` header)
  2. Optional `CRON_SECRET` for additional security
  3. Service role key authentication for Supabase operations

## Monitoring

Monitor cron job execution:

1. **Vercel Dashboard** → **Deployments** → View function logs
2. **Supabase Dashboard** → **Edge Functions** → View function logs
3. Check API route logs in Vercel for any errors

## Troubleshooting

### Cron jobs not running
- Verify environment variables are set correctly
- Check Vercel cron job configuration in dashboard
- Review deployment logs for errors

### Authentication errors
- Verify `CRON_SECRET` matches in both Vercel and edge function
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Ensure service role key has proper permissions

### Edge function errors
- Check Supabase Edge Function logs
- Verify edge functions are deployed
- Review edge function code for issues

## Manual Testing

To test without waiting for the scheduled time:

```bash
# Set your environment variables
export CRON_SECRET="your-secret"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Test health refresh
curl -X GET "http://localhost:3000/api/cron/health-refresh?secret=$CRON_SECRET"

# Test email sync
curl -X GET "http://localhost:3000/api/cron/email-sync?secret=$CRON_SECRET"
```

## Next Steps

After setup:
1. Monitor the first few cron job executions
2. Verify health scores are being refreshed
3. Check email sync is working for active users
4. Adjust schedules if needed in `vercel.json`

---

**Last Updated**: November 23, 2025
**Version**: 1.0












