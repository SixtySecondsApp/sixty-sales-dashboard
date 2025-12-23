# Edge Function Setup Guide

## Current Issue
The Edge Functions are returning "non-2xx status code" errors because they need the Google OAuth client credentials to be configured as environment variables in Supabase.

## Required Environment Variables

The following environment variables need to be set in your Supabase project for the Edge Functions to work:

1. `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
2. `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret

## Setup Instructions

### 1. Get Your Google OAuth Credentials

From your `.env.local` file, you have:
- `VITE_GOOGLE_CLIENT_ID=54769809818-d7jsdcqdfp8bn4copr94r4h4jcm08dpk.apps.googleusercontent.com`
- `VITE_GOOGLE_CLIENT_SECRET=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`

### 2. Set Environment Variables in Supabase

#### Option A: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to Settings → Edge Functions
3. Add the following secrets:
   - `GOOGLE_CLIENT_ID` = `54769809818-d7jsdcqdfp8bn4copr94r4h4jcm08dpk.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `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`

#### Option B: Using Supabase CLI
```bash
# Make sure you're linked to your project
supabase link --project-ref ewtuefzeogytgmsnkpmb

# Set the secrets
supabase secrets set GOOGLE_CLIENT_ID=54769809818-d7jsdcqdfp8bn4copr94r4h4jcm08dpk.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=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

# Verify the secrets are set
supabase secrets list
```

### 3. Deploy/Redeploy Edge Functions

After setting the environment variables, redeploy your Edge Functions:

```bash
# Deploy the Google Gmail function
supabase functions deploy google-gmail

# Deploy the Google Calendar function  
supabase functions deploy google-calendar
```

### 4. Verify the Functions

After deployment, you can verify the functions are working by:
1. Going to the Google Integration Tests page at `/admin/google-integration-tests`
2. Clicking "Run All Tests"
3. The Edge Function tests should now pass

## Troubleshooting

### Issue: "Google integration not found"
**Solution**: This means the Edge Functions are working, but the user hasn't connected their Google account yet. Go to the Integrations page to connect Google.

### Issue: "Invalid authentication token"
**Solution**: Your session may have expired. Refresh the page and try again.

### Issue: "FunctionInvokeError" or "non-2xx status code"
**Solution**: The Edge Functions are not deployed or the GOOGLE_CLIENT_ID/SECRET environment variables are not set. Follow the setup instructions above.

### Issue: Functions still failing after setting secrets
**Solution**: 
1. Make sure the secrets are set correctly (no extra spaces or quotes)
2. Redeploy the functions after setting the secrets
3. Wait a few minutes for the changes to propagate
4. Check the function logs in Supabase dashboard for more details

## Current Test Status

Based on the test results shown, the following are working:
✅ Database authentication tests
✅ Google integration database records
✅ Calendar sync status checks
✅ Calendar events database structure
✅ Gmail database structure

The following need the environment variables to be set:
❌ Edge Function: List Gmail Messages
❌ Edge Function: Get Gmail Labels  
❌ Edge Function: List Calendar Events
❌ Edge Function: List Google Calendars
❌ Edge Function: Check Calendar Availability

## Next Steps

1. Set the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase
2. Redeploy the Edge Functions
3. Run the tests again to verify everything is working
4. If tests pass, the Google integration features (Email and Calendar pages) should work properly