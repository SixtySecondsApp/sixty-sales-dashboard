# Fix: Entry Not Visible in Admin Panel

Your entry exists in the database with:
- ✅ `is_seeded = false`
- ✅ `status = 'pending'`
- ✅ `display_rank = 1199`

## Possible Issues:

### 1. **Pagination** (Most Likely)
Your entry is on **page 24** (1199 ÷ 50 = ~24). 
- **Solution**: Navigate to page 24 in the admin panel, or use the search box to find your entry

### 2. **Search Filter Active**
If there's text in the search box, it filters results.
- **Solution**: Clear the search box

### 3. **Supabase PostgREST Schema Cache**
The view was recently updated. PostgREST might not recognize it.
- **Solution**: Refresh the schema cache in Supabase Dashboard:
  1. Go to **Settings** → **API**
  2. Click **"Refresh Schema Cache"** or **"Reload Schema"**
  3. Wait 30 seconds
  4. Refresh your browser

### 4. **Browser Cache**
Your browser might be caching old data.
- **Solution**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

## Quick Test:

Run this in Supabase SQL Editor to verify the entry is fetchable:

```sql
-- Test if entry is accessible via the view
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  display_rank,
  CASE 
    WHEN is_seeded = false OR is_seeded IS NULL THEN '✓ Should be visible'
    ELSE '⚠️ Hidden (seeded)'
  END as visibility
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video';
```

## Immediate Actions:

1. **Clear search box** (if anything is typed)
2. **Navigate to page 24** or search for "max.parish"
3. **Refresh Supabase schema cache** (Settings → API → Refresh Schema Cache)
4. **Hard refresh browser** (Cmd+Shift+R)


