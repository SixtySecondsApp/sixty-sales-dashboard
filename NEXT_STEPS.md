# Next Steps - Email Sync & Health Score Automation

## ✅ Completed

- [x] All 3 migrations applied successfully
- [x] Edge functions deployed (`scheduled-health-refresh`, `scheduled-email-sync`)
- [x] `ANTHROPIC_API_KEY` is set in Supabase

## 🔐 Step 1: Set CRON_SECRET in Supabase

Generate and set the cron secret:

```bash
# Generate secret
openssl rand -hex 32

# Set in Supabase (replace with your generated secret)
supabase secrets set CRON_SECRET=your-generated-secret-here
```

**Or via Supabase Dashboard:**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add new secret: `CRON_SECRET` = `[your-generated-secret]`

## 🌐 Step 2: Set Environment Variables in Vercel

Go to your Vercel project dashboard:

1. Navigate to **Settings** → **Environment Variables**
2. Add these variables:

   **Required:**
   - `CRON_SECRET` - Use the same value you set in Supabase
   - `SUPABASE_URL` - Your Supabase project URL (if not already set)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (if not already set)

   **Optional (if not already set):**
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

## 🚀 Step 3: Deploy to Vercel

After setting environment variables, deploy:

```bash
# Deploy to Vercel
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git push origin main
```

## ✅ Step 4: Verify Vercel Cron Jobs

After deployment:

1. Go to **Vercel Dashboard** → **Settings** → **Cron Jobs**
2. You should see two cron jobs:
   - `health-refresh` - Runs daily at 7:00 AM UTC
   - `email-sync` - Runs daily at 8:00 AM UTC

## 🧪 Step 5: Test Functions Manually

Test the edge functions to verify they work:

```bash
# Replace YOUR_CRON_SECRET with the secret you generated
export CRON_SECRET="your-generated-secret"

# Test health refresh
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-health-refresh"

# Test email sync
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/scheduled-email-sync"
```

Or test via Vercel API routes:

```bash
# Test via Vercel cron endpoints (after deployment)
curl -X GET "https://your-app.vercel.app/api/cron/health-refresh?secret=$CRON_SECRET"
curl -X GET "https://your-app.vercel.app/api/cron/email-sync?secret=$CRON_SECRET"
```

## 📊 Step 6: Monitor & Verify

### Check Supabase Edge Function Logs
```bash
# View logs for health refresh
supabase functions logs scheduled-health-refresh --tail

# View logs for email sync
supabase functions logs scheduled-email-sync --tail
```

### Verify Data
```sql
-- Check if communication_events table has email data
SELECT COUNT(*) as email_count, 
       COUNT(*) FILTER (WHERE ai_analyzed = true) as analyzed_count
FROM communication_events 
WHERE sync_source = 'gmail';

-- Check if health scores are being refreshed
SELECT COUNT(*) as total_scores,
       MAX(last_calculated_at) as last_refresh
FROM deal_health_scores;

-- Check last login tracking
SELECT COUNT(*) as users_with_login_tracking
FROM profiles 
WHERE last_login_at IS NOT NULL;
```

## 🎯 Summary Checklist

- [ ] Set `CRON_SECRET` in Supabase secrets
- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Set `SUPABASE_URL` in Vercel (if not already set)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel (if not already set)
- [ ] Deploy to Vercel
- [ ] Verify cron jobs appear in Vercel dashboard
- [ ] Test functions manually
- [ ] Monitor logs after first scheduled run

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [Vercel Cron Setup](./VERCEL_CRON_SETUP.md) - Detailed Vercel configuration
- [Deployment Summary](./DEPLOYMENT_SUMMARY.md) - Quick reference

---

**Status**: Migrations Complete ✅ | Environment Setup Next ⏳



























