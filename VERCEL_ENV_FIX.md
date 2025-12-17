# Fix Missing Environment Variables in Vercel Production

## 🚨 Issue
Production site is showing: `Missing required Supabase environment variables. Please check your .env.local file.`

## ✅ Solution: Add Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Navigate to https://vercel.com/dashboard
2. Select your project (sixty-sales-dashboard or sales.sixtyseconds.video)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Variables

Add these **REQUIRED** variables for **Production**, **Preview**, and **Development**:

#### Required Frontend Variables (VITE_ prefix):
```
VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8
```

**Important**: 
- Make sure to select **Production**, **Preview**, AND **Development** environments
- These values are from your `.env.local` file

### Step 3: Verify Variables Are Set

After adding, verify:
1. All three environments (Production, Preview, Development) are selected
2. Variables are spelled correctly (case-sensitive)
3. No extra spaces or quotes

### Step 4: Redeploy

After adding variables, trigger a new deployment:

**Option A: Via Vercel Dashboard**
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Click **Redeploy**

**Option B: Via Git**
```bash
# Make a small change and push
git commit --allow-empty -m "Trigger redeploy for env vars"
git push origin main
```

**Option C: Via Vercel CLI**
```bash
vercel --prod
```

## 🔍 Verify Variables Are Loaded

After redeployment, check:
1. Visit your production site
2. Open browser console (F12)
3. The error should be gone
4. Login should work

## 📋 Complete Environment Variable Checklist

Make sure these are set in Vercel:

### Frontend (Required):
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`

### Optional (if using cron jobs):
- `CRON_SECRET`
- `SUPABASE_URL` (without VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` (without VITE_ prefix)

## 🐛 Troubleshooting

### Variables not loading after redeploy?
1. Check variable names are exact (case-sensitive)
2. Ensure all environments are selected (Production, Preview, Development)
3. Clear browser cache and hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. Check Vercel deployment logs for errors

### Still seeing the error?
1. Check Vercel deployment logs: **Deployments** → Click deployment → **Build Logs**
2. Verify variables are in the build output (they should be visible in logs)
3. Make sure you're checking the correct Vercel project

## 📝 Quick Reference

**Vercel Dashboard Path:**
```
Project → Settings → Environment Variables
```

**Required Variables:**
- `VITE_SUPABASE_URL` = `https://ewtuefzeogytgmsnkpmb.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (full key from .env.local)

---

**Last Updated**: January 2025






























