# Fix Meetings RLS Permission Error

## Problem
- Meetings are in the database but not showing in frontend
- Error: "permission denied for table users" (403)
- Frontend query trying to join meetings → companies fails due to RLS policies

## Root Cause
The RLS (Row Level Security) policies on the `meetings` and `companies` tables are either:
1. Too restrictive or incorrectly configured
2. Trying to access `auth.users` table without proper permissions
3. Preventing the join between meetings and companies

## Solution

### Step 1: Apply RLS Fix

Run this in Supabase SQL Editor:

**File**: `FIX_MEETINGS_RLS.sql`

This SQL script will:
1. ✅ Drop all existing problematic RLS policies
2. ✅ Create clean, simple RLS policies for meetings
3. ✅ Create clean, simple RLS policies for companies
4. ✅ Create clean, simple RLS policies for meeting_action_items
5. ✅ Add service role bypass for Edge Functions
6. ✅ Enable proper SELECT permissions for joins

### Step 2: Verify the Fix

After running the SQL, test with this query:

```sql
-- Test as authenticated user
SELECT
  m.id,
  m.title,
  m.meeting_start,
  m.owner_user_id,
  c.name as company_name,
  c.domain as company_domain
FROM meetings m
LEFT JOIN companies c ON c.id = m.company_id
WHERE m.owner_user_id = auth.uid()
ORDER BY m.meeting_start DESC
LIMIT 5;
```

Expected result: You should see your meetings with company data

### Step 3: Check Frontend

Refresh the frontend at `/meetings` - meetings should now load successfully.

## What Changed

### Before (Problematic)
```sql
-- Complex policies trying to access auth.users
CREATE POLICY "meetings_policy" ON meetings
  FOR SELECT USING (
    owner_user_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
    )
  );
```

### After (Fixed)
```sql
-- Simple, direct policies
CREATE POLICY "meetings_select_policy" ON meetings
  FOR SELECT USING (
    owner_user_id = auth.uid()
  );
```

## RLS Policy Structure

### Meetings Table
- `meetings_select_policy` - Users can view their own meetings
- `meetings_insert_policy` - Users can create meetings
- `meetings_update_policy` - Users can update their own meetings
- `meetings_delete_policy` - Users can delete their own meetings
- `meetings_service_role_all` - Service role (Edge Functions) has full access

### Companies Table
- `companies_select_policy` - Users can view companies they own
- `companies_insert_policy` - Users can create companies
- `companies_update_policy` - Users can update their own companies
- `companies_delete_policy` - Users can delete their own companies
- `companies_service_role_all` - Service role has full access

### Meeting Action Items Table
- `action_items_select_policy` - Users can view action items for their meetings
- `action_items_insert_policy` - Users can create action items for their meetings
- `action_items_update_policy` - Users can update action items for their meetings
- `action_items_delete_policy` - Users can delete action items for their meetings
- `action_items_service_role_all` - Service role has full access

## Verification Checklist

After applying the fix:

- [ ] Run `FIX_MEETINGS_RLS.sql` in Supabase SQL Editor
- [ ] Verify policies created (query at end of SQL file)
- [ ] Test query to fetch meetings with company join
- [ ] Refresh frontend `/meetings` page
- [ ] Confirm meetings load without 403 errors
- [ ] Verify action items display correctly
- [ ] Check browser console for errors (should be clean)

## Expected Frontend Behavior

**Before Fix**:
```
❌ Failed to load resource: 403
❌ Error fetching meetings: permission denied for table users
❌ No meetings displayed
```

**After Fix**:
```
✅ Meetings load successfully
✅ Company names display correctly
✅ Action items counts show
✅ No console errors
```

## Troubleshooting

### If meetings still don't show:

1. **Check user is authenticated**:
```sql
SELECT auth.uid(); -- Should return your user ID
```

2. **Check meetings exist for your user**:
```sql
SELECT COUNT(*) FROM meetings WHERE owner_user_id = auth.uid();
```

3. **Check RLS is enabled**:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('meetings', 'companies', 'meeting_action_items');
```

4. **Verify policies exist**:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('meetings', 'companies', 'meeting_action_items')
ORDER BY tablename, policyname;
```

### If you get different errors:

- **"relation does not exist"**: Check table names are correct
- **"column does not exist"**: Verify `owner_user_id` exists in meetings table
- **"function auth.uid() does not exist"**: Check you're connected as authenticated user, not anon

## Related Files

- `FIX_MEETINGS_RLS.sql` - The RLS fix SQL script
- `CHECK_MEETINGS_RLS.sql` - Diagnostic queries
- `src/components/meetings/MeetingsList.tsx:147` - Frontend query that was failing

---

**Run the SQL fix now and verify meetings load in the frontend!** 🚀
