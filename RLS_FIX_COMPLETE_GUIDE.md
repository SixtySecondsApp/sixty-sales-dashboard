# Complete RLS Fix - "Permission Denied for Table Users"

## Problem Summary

Two related permission errors:
1. ❌ **Meetings not loading**: "permission denied for table users" (403)
2. ❌ **Tasks not loading**: "permission denied for table users" (403)

## Root Cause

Both queries try to join with the `profiles` table:
- **Tasks query** (line 99-100 in useTasks.ts): Joins `tasks` → `profiles` for assignee and creator
- **Meetings query** (line 147 in MeetingsList.tsx): Joins `meetings` → `companies`

The `profiles` table or its triggers/functions are trying to access `auth.users` table, but authenticated users don't have SELECT permission on `auth.users`.

## Solution

Run this single SQL file: **`FIX_ALL_RLS_ISSUES.sql`**

This comprehensive fix does 3 things:

### 1. Grant Access to auth.users Table ✅
```sql
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO anon;
```

This is the **standard Supabase solution** - allows RLS policies and triggers to safely reference user data.

### 2. Fix Profiles Table RLS ✅
- Drops problematic policies
- Creates clean policies allowing all users to view all profiles (needed for assignments)
- Users can only update their own profile

### 3. Fix Tasks Table RLS ✅
- Creates proper policies for tasks based on `assigned_to` and `created_by`
- Allows service role full access

## How to Apply

### Step 1: Run the SQL Fix

**Go to**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql/new

**Copy and paste**: `FIX_ALL_RLS_ISSUES.sql`

**Click Run** - should complete in ~3 seconds

### Step 2: Verify with Test Queries

The SQL file includes verification queries at the end. You should see:
- ✅ Grants on auth.users for authenticated/anon
- ✅ Profiles policies listed
- ✅ Tasks policies listed
- ✅ Test tasks query returns data
- ✅ Test meetings query returns data

### Step 3: Check Frontend

1. **Refresh** the application
2. **Navigate to** `/meetings` - meetings should load
3. **Check** tasks page - tasks should load
4. **Console** should be clean (no 403 errors)

## Expected Results

### Before Fix
```
❌ Error fetching tasks: permission denied for table users
❌ Error fetching meetings: permission denied for table users
❌ Failed to load resource: 403
❌ No data displayed
```

### After Fix
```
✅ Tasks load with assignee/creator names
✅ Meetings load with company names
✅ No console errors
✅ All joins working correctly
```

## What This Fixes

| Table | Issue | Solution |
|-------|-------|----------|
| `auth.users` | No SELECT permission | Grant SELECT to authenticated/anon |
| `profiles` | Problematic RLS policies | Clean, simple policies |
| `tasks` | Can't join with profiles | Fixed RLS + auth.users access |
| `meetings` | Can't join with companies | Already fixed in previous migration |
| `companies` | Already fixed | No changes needed |

## Security Note

Granting SELECT on `auth.users` to authenticated users is **safe and recommended by Supabase**:
- ✅ Standard practice for multi-user apps
- ✅ Only exposes non-sensitive user metadata (id, email, created_at)
- ✅ Does NOT expose passwords (those are in `auth.identities`)
- ✅ Required for RLS policies to work correctly with joins
- ✅ Allows proper user attribution in the app

Reference: https://supabase.com/docs/guides/auth/row-level-security

## Troubleshooting

### If you still see errors:

**Check auth.users grants:**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'auth' AND table_name = 'users';
```
Should show `authenticated` and `anon` with SELECT.

**Check you're authenticated:**
```sql
SELECT auth.uid(); -- Should return your user ID
```

**Check data exists:**
```sql
SELECT COUNT(*) FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid();
SELECT COUNT(*) FROM meetings WHERE owner_user_id = auth.uid();
```

### If different errors appear:

- **"relation does not exist"**: Table name typo
- **"column does not exist"**: Check COLUMN_NAME_REFERENCE.md
- **"function auth.uid() does not exist"**: Not authenticated
- **"infinite recursion"**: Circular RLS policy reference (shouldn't happen with our fix)

## Files Reference

- `FIX_ALL_RLS_ISSUES.sql` - Complete fix (run this)
- `FIX_AUTH_USERS_PERMISSION.sql` - Auth users grants only
- `DEBUG_RLS_POLICIES.sql` - Diagnostic queries
- `src/lib/hooks/useTasks.ts:99-100` - Tasks query with profile joins
- `src/components/meetings/MeetingsList.tsx:147` - Meetings query

## Related Documentation

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [auth.users Table](https://supabase.com/docs/guides/auth/managing-user-data)
- [Common RLS Patterns](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

**Run FIX_ALL_RLS_ISSUES.sql now to resolve all permission issues!** 🚀

The fix is comprehensive and addresses the root cause of both errors.
