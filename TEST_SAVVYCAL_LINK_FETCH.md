# Test SavvyCal Link Fetch - Quick Guide

## ✅ Setup Complete

- ✅ Edge function deployed: `fetch-savvycal-link`
- ✅ API token configured: `SAVVYCAL_API_TOKEN`
- ✅ UI integration ready: "Fetch from API" button

## 🧪 Testing Steps

### Option 1: Test via UI (Recommended)

1. **Open the SavvyCal Settings page:**
   ```
   http://localhost:5173/admin/savvycal-settings
   ```

2. **Click "Add Mapping"** button

3. **Enter a link ID** from your CSV:
   ```
   link_01G546GHBJD033660AV798D5FY
   ```

4. **Click "Fetch from API"** button

5. **Expected Results:**
   - ✅ Link details fetched from SavvyCal
   - ✅ Source field auto-filled based on link name
   - ✅ Notes field populated with link information
   - ✅ Success toast notification

### Option 2: Test via Browser Console

1. **Open your app** and log in: `http://localhost:5173`

2. **Open browser DevTools** (F12)

3. **Go to Console tab**

4. **Run this code:**
   ```javascript
   // Get your session
   const { data: { session } } = await supabase.auth.getSession();
   
   // Test the function
   const { data, error } = await supabase.functions.invoke('fetch-savvycal-link', {
     body: { link_id: 'link_01G546GHBJD033660AV798D5FY' }
   });
   
   console.log('Result:', data);
   console.log('Error:', error);
   ```

### Option 3: Test via cURL

```bash
# First, get your JWT token from browser localStorage:
# localStorage.getItem('sb-ewtuefzeogytgmsnkpmb-auth-token')

# Then test:
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fetch-savvycal-link' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"link_id": "link_01G546GHBJD033660AV798D5FY"}'
```

## 📋 Sample Link IDs for Testing

From your CSV file:
- `link_01G546GHBJD033660AV798D5FY`
- `link_01JBKF8K31JXM7E4SWCAJZ41Z1`
- `link_01HFP52WV5SNC0QJ64PMS5QZKX`

## ✅ Expected Success Response

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

## 🔍 What to Verify

1. **Function Connectivity:**
   - ✅ Edge function responds without errors
   - ✅ Returns link details from SavvyCal API

2. **Source Auto-Suggestion:**
   - ✅ Matches link names to booking sources
   - ✅ Falls back to custom source if no match
   - ✅ Fills in source field automatically

3. **UI Integration:**
   - ✅ "Fetch from API" button works
   - ✅ Loading state shows while fetching
   - ✅ Success/error toasts display correctly
   - ✅ Form fields populate with fetched data

## 🐛 Troubleshooting

### Error: "SavvyCal API token not configured"
- **Solution**: Token is already set, but if you see this, verify:
  ```bash
  supabase secrets list | grep SAVVYCAL_API_TOKEN
  ```

### Error: "401 Unauthorized" from SavvyCal
- **Solution**: Check token is valid and has proper permissions
- Verify token in SavvyCal Settings → API

### Error: "404 Not Found" for link_id
- **Solution**: Verify link_id exists in your SavvyCal account
- Check link_id format (should start with `link_`)

### Button doesn't work
- **Solution**: 
  1. Check browser console for errors
  2. Verify you're logged in
  3. Check network tab for function call

## 🎯 Next Steps After Testing

Once verified:
1. ✅ Use "Fetch from API" for all new link mappings
2. ✅ Bulk import link IDs from CSV
3. ✅ Auto-map sources based on link names
4. ✅ Track conversions by source







