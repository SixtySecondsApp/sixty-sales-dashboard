# Fix "Database error granting use"

## 🚨 Error

**Error Message**: "Database error granting use"

**Cause**: Missing database permissions (USAGE grants on schemas)

## ✅ Solution

Run the SQL fix in Supabase Dashboard:

### Step 1: Open SQL Editor

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql/new
2. Copy the contents of `fix-database-permissions.sql`
3. Paste into SQL Editor
4. Click **Run**

### Step 2: Verify

The script will output a summary showing:
- ✅ Schema usage grants
- ✅ Auth.users access
- ✅ All permissions granted successfully

## 🔍 What This Fixes

The script grants:

1. **Schema Usage**: `GRANT USAGE ON SCHEMA` for public and auth schemas
2. **Auth Users Access**: `GRANT SELECT ON auth.users` (required for RLS)
3. **Table Permissions**: SELECT, INSERT, UPDATE, DELETE on all tables
4. **Sequence Permissions**: USAGE and SELECT on sequences (for auto-increment)
5. **Function Permissions**: EXECUTE on all functions
6. **Default Privileges**: Sets defaults for future objects

## 📋 Common Permission Errors Fixed

- ✅ "Database error granting use"
- ✅ "permission denied for schema public"
- ✅ "permission denied for table users"
- ✅ "insufficient privilege"
- ✅ "permission denied for function"

## 🔐 Security Note

These grants follow Supabase best practices:
- `authenticated` users get full access to their data (via RLS)
- `anon` users get read-only access (via RLS)
- `service_role` gets full access (for edge functions)

RLS policies still enforce data security - these grants just allow the queries to run.

## 🐛 If Error Persists

If you still get errors after running this:

1. **Check RLS Policies**: Ensure tables have proper RLS policies
2. **Check User Role**: Verify you're authenticated
3. **Check Table Exists**: Verify the table you're querying exists
4. **Check Column Names**: Ensure column names match your queries

## 📚 Related Files

- `fix-database-permissions.sql` - The fix script
- `RLS_FIX_COMPLETE.md` - Previous RLS fixes
- `SECURITY_FIX.md` - Service role key removal

---

**Status**: ✅ Ready to run  
**Last Updated**: November 23, 2025




















