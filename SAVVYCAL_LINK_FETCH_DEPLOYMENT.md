# SavvyCal Link Fetch - Deployment & Testing Guide

## Overview

This guide covers deploying and testing the SavvyCal link fetching functionality that automatically maps link IDs to sources using the SavvyCal API.

## Prerequisites

1. **Supabase CLI** installed and logged in
2. **SavvyCal API Token** - Get from your SavvyCal account settings
3. **Supabase project** linked

## Step 1: Set SavvyCal API Token

The edge function needs your SavvyCal API token to authenticate with the SavvyCal API.

```bash
# Set the API token as a Supabase secret
supabase secrets set SAVVYCAL_API_TOKEN=your_token_here

# Or if you use SAVVYCAL_SECRET_KEY instead
supabase secrets set SAVVYCAL_SECRET_KEY=your_token_here

# Verify the secret is set
supabase secrets list | grep SAVVYCAL
```

**How to get your SavvyCal API Token:**
1. Log in to your SavvyCal account
2. Go to Settings → API
3. Create a new Personal Access Token or use an existing one
4. Copy the token (starts with `pt_secret_` or similar)

## Step 2: Deploy Edge Function

The function is already deployed, but if you need to redeploy:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase functions deploy fetch-savvycal-link
```

## Step 3: Test the Function

### Option A: Test via UI

1. Navigate to `/admin/savvycal-settings`
2. Click "Add Mapping"
3. Enter a link ID (e.g., `link_01G546GHBJD033660AV798D5FY`)
4. Click "Fetch from API" button
5. The system should:
   - Fetch link details from SavvyCal
   - Auto-suggest a source based on link name
   - Fill in the source field automatically

### Option B: Test via Script

```bash
# Make sure you're logged in to the app first (get session token)
tsx scripts/test-savvycal-link-fetch.ts link_01G546GHBJD033660AV798D5FY
```

### Option C: Test via cURL

```bash
# Get your Supabase anon key and JWT token
# Then test the function:
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fetch-savvycal-link' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"link_id": "link_01G546GHBJD033660AV798D5FY"}'
```

## Step 4: Verify Functionality

### Expected Behavior

1. **Link Fetching**: When you enter a link ID and click "Fetch from API":
   - ✅ Fetches link details from SavvyCal API
   - ✅ Returns link name, slug, description, and URL
   - ✅ Auto-suggests a source based on link name/slug
   - ✅ Fills in notes with link information

2. **Source Matching**: The system matches link names to sources:
   - "facebook" or "fb" → Facebook Ads
   - "linkedin" → LinkedIn
   - "google" → Google Ads
   - "website" or "homepage" → Website
   - "email" → Email Campaign
   - "referral" → Referral

3. **Fallback**: If no match is found:
   - Uses link name as custom source
   - Prompts user to select or enter a source

## Troubleshooting

### Error: "SavvyCal API token not configured"

**Solution**: Set the API token:
```bash
supabase secrets set SAVVYCAL_API_TOKEN=your_token_here
```

### Error: "401 Unauthorized" from SavvyCal API

**Solution**: 
- Verify your API token is correct
- Check token hasn't expired
- Ensure token has proper permissions

### Error: "404 Not Found" for link_id

**Solution**: 
- Verify the link_id exists in your SavvyCal account
- Check the link_id format (should start with `link_`)

### Function not appearing in UI

**Solution**:
1. Check function is deployed: `supabase functions list`
2. Verify route in `src/App.tsx`: `/admin/savvycal-settings`
3. Check browser console for errors
4. Ensure user is logged in

## Sample Link IDs for Testing

From your CSV file:
- `link_01G546GHBJD033660AV798D5FY`
- `link_01JBKF8K31JXM7E4SWCAJZ41Z1`
- `link_01HFP52WV5SNC0QJ64PMS5QZKX`

## Next Steps

1. ✅ Deploy function
2. ✅ Set API token
3. ✅ Test with sample link IDs
4. ✅ Verify auto-source suggestion works
5. ✅ Test bulk CSV import with auto-fetch (future enhancement)

## API Reference

**Endpoint**: `POST /functions/v1/fetch-savvycal-link`

**Request Body**:
```json
{
  "link_id": "link_01G546GHBJD033660AV798D5FY"
}
```

**Response**:
```json
{
  "success": true,
  "link": {
    "id": "link_01G546GHBJD033660AV798D5FY",
    "slug": "chat",
    "name": "Discovery Call",
    "description": "30-minute discovery call",
    "url": "https://savvycal.com/your-username/chat"
  }
}
```







