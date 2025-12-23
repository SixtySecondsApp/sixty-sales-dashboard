# Immediate Steps to See Your Entry

## Step 1: Search for Your Entry
In the admin panel search box, type:
- `max.parish` (your email)
- OR `max` (your name)

This will filter to show only matching entries and should find your entry immediately.

## Step 2: Refresh Supabase Schema Cache
The view was recently updated. PostgREST might not recognize it:

1. Go to **Supabase Dashboard**
2. Navigate to **Settings** → **API**
3. Look for **"Refresh Schema Cache"** or **"Reload Schema"** button
4. Click it and wait 30 seconds
5. Refresh your browser (hard refresh: Cmd+Shift+R)

## Step 3: Navigate to Your Page
If search doesn't work, your entry is on **page 24**:
- Use the pagination controls at the bottom of the table
- Navigate to page 24

## Step 4: Verify Entry is Fetchable
Run this in Supabase SQL Editor to confirm:

```sql
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  display_rank,
  FLOOR((display_rank - 1) / 50) + 1 as page_number
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video';
```

This will show you which page your entry is on.

## Step 5: Check Browser Console
Open browser DevTools (F12) and check:
- **Console tab**: Look for any errors
- **Network tab**: Check if the API call to `waitlist_with_rank` is successful

## Most Likely Solution:
**Search for "max.parish" in the search box** - this should find your entry immediately regardless of pagination.


