# Supabase Project Migration Guide

## Overview
This guide helps you update the Supabase project configuration after switching to a new Supabase project.

## Required Environment Variables

You need to update these two environment variables with your new Supabase project credentials:

- `VITE_SUPABASE_URL` - Your new Supabase project URL (e.g., `https://your-new-project.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your new Supabase project's anon/publishable key

## Where to Update

### 1. Vercel Production Deployment (CRITICAL)

**For Production Site (www.use60.com):**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Update or add:
   - `VITE_SUPABASE_URL` = `https://your-new-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-new-anon-key`
5. **Redeploy** the application for changes to take effect

**Important:** Make sure these are set for:
- ✅ Production
- ✅ Preview  
- ✅ Development (if you use Vercel for dev)

### 2. Local Development (.env.local)

Create or update `.env.local` in the **root** of your project:

```bash
# Root directory: /Users/andrewbryce/Documents/sixty-sales-dashboard/.env.local
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key
```

**Note:** If you're working in the `packages/landing` directory, you may also need a `.env.local` there, but typically the root one is sufficient.

### 3. Test HTML Files (Optional - Less Critical)

There are some hardcoded references to the old project in test files. These are only used for debugging and won't affect production:

**Files to update (optional):**
- `packages/landing/public/test-auth.html`
- `packages/landing/public/test-profile.html`
- `packages/landing/public/test-profile-fetch.html`
- `packages/landing/public/test-hard-refresh.html`
- `packages/landing/public/direct-login.html`
- `packages/landing/public/fix-session.html`
- `packages/landing/public/debug-auth-state.html`
- `packages/landing/public/debug-profile-issue.html`
- `packages/landing/public/debug-google-integration.html`
- `packages/landing/public/session-debug.html`
- `packages/landing/public/quick-fix-profile.html`
- `packages/landing/public/login-helper.html`

**Old project reference:** `ewtuefzeogytgmsnkpmb`

Replace with your new project reference in these files if you use them for testing.

## Verification Steps

### 1. Check Environment Variables Are Loaded

After updating, verify the environment variables are being read:

1. Open browser console on your site
2. Check for any errors about missing Supabase configuration
3. The error should disappear once variables are correctly set

### 2. Test Waitlist Signup

1. Navigate to `https://www.use60.com/waitlist`
2. Fill out the form
3. Submit and verify it connects to the new Supabase project
4. Check browser Network tab - requests should go to your new Supabase URL

### 3. Check Supabase Dashboard

1. Go to your new Supabase project dashboard
2. Check **Logs** → **API Logs** to see if requests are coming through
3. Verify the `meetings_waitlist` table exists and has the correct schema

## Common Issues

### Issue: Still Getting Connection Errors

**Solution:**
- Make sure you **redeployed** after updating Vercel environment variables
- Clear browser cache and hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Check that environment variables are set for the correct environment (Production/Preview)

### Issue: Environment Variables Not Found

**Solution:**
- Verify `.env.local` is in the **root** directory, not in `packages/landing`
- Restart your dev server after creating/updating `.env.local`
- Check that variable names start with `VITE_` prefix

### Issue: Old Project Still Being Used

**Solution:**
- Check if there are any cached builds in Vercel
- Force a new deployment
- Check browser localStorage for old auth tokens and clear them

## Database Migration

If you're migrating data from the old project:

1. **Export data** from old Supabase project:
   ```sql
   -- Export waitlist entries
   COPY meetings_waitlist TO '/tmp/waitlist_export.csv' CSV HEADER;
   ```

2. **Import to new project:**
   - Use Supabase Dashboard → Table Editor → Import
   - Or use SQL import commands

3. **Verify migrations:**
   - Ensure all migrations from `supabase/migrations/` are applied
   - Check that triggers and functions are created
   - Verify RLS policies are set correctly

## Next Steps

1. ✅ Update Vercel environment variables
2. ✅ Redeploy application
3. ✅ Test waitlist signup
4. ✅ Verify data is being saved to new project
5. ✅ (Optional) Update test HTML files
6. ✅ (Optional) Migrate existing waitlist data

## Support

If you encounter issues:
1. Check Supabase project status (not paused)
2. Verify API keys are correct
3. Check browser console for specific error messages
4. Review Supabase Dashboard logs for API errors
















