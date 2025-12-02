# Quick Debugging Steps

Please check these and let me know what you see:

## 1. Browser Console Errors
Open browser console (F12) and check for:
- Any red errors?
- What do they say?

## 2. What Do You See?
When you navigate to `http://localhost:5175/crm/leads?source=LinkedIn+Ads`:

- [ ] Completely blank white screen?
- [ ] Empty state message (with 🔍 icon)?
- [ ] Header/toolbar visible but no content?
- [ ] Loading spinner that never stops?
- [ ] Something else? (describe)

## 3. Check Network Tab
In browser dev tools, Network tab:
- Is there a request to fetch leads?
- Does it return data?
- How many leads in the response?

## 4. Test Without Filters
Navigate to just `/crm/leads` (no filters):
- Does the leads page load normally?
- Can you see your leads list?

## 5. Check Filter Logic
In browser console, run:
```javascript
// Get current URL params
const params = new URLSearchParams(window.location.search);
console.log('Source filter:', params.get('source'));
console.log('Stage filter:', params.get('stage'));
```

What does it print?

## 6. Check Lead Data Structure
In browser console, run:
```javascript
// Check if leads have converted_deal
const leadsResponse = await fetch('http://localhost:54321/rest/v1/leads?select=id,contact_name,converted_deal:deals!leads_converted_deal_id_fkey(id,name,stage:deal_stages!deals_stage_id_fkey(id,name))&limit=1', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
});
const leads = await leadsResponse.json();
console.log('Lead with deal:', leads[0]);
```

Does converted_deal show up?
