# Fix: pg_net Extension Not Enabled

## 🚨 Error Found

```
function net.http_post(url => text, headers => jsonb, body => text, timeout_milliseconds => integer) does not exist
```

**Root Cause**: The `pg_net` extension is not enabled in your Supabase database. This extension is required for database functions to make HTTP requests to Edge Functions.

## ✅ Quick Fix (2 minutes)

### Step 1: Enable pg_net Extension

**Copy and run this in Supabase SQL Editor**:

```sql
-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;

-- Verify
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';
```

**Expected result**:
```
extname | extversion
--------+-----------
pg_net  | 0.7.3
```

### Step 2: Re-run Force Generation

**Now that pg_net is enabled, run this again**:

```sql
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE m.transcript_text IS NOT NULL
ORDER BY m.created_at DESC;
```

**Expected result**:
```
id                  | title                     | triggered
--------------------+---------------------------+-----------
abc-123...          | Sales Call with Acme      | t
def-456...          | Demo for Tech Startup     | t
```

✅ `triggered = t` means success!

### Step 3: Check Edge Function Logs

```bash
supabase functions logs suggest-next-actions --limit 50
```

**You should now see**:
```
INFO | Received request: {"activityId":"abc-123..."}
INFO | Analyzing transcript with Claude...
INFO | Created 3 suggestions
INFO | Response: {"success":true}
```

### Step 4: Verify Suggestions in Database

```sql
SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting';
```

**Expected**: 20-50 suggestions (2-5 per meeting × 10 meetings)

## 🔧 Alternative: Supabase CLI

If SQL Editor doesn't work, use the CLI:

```bash
# Enable extension via CLI
supabase db execute "CREATE EXTENSION IF NOT EXISTS pg_net;"

# Grant permissions
supabase db execute "
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;
"

# Verify
supabase db execute "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';"
```

## 📊 What pg_net Does

The `pg_net` extension allows PostgreSQL to make HTTP requests from within database functions. This is how the trigger system works:

```
1. Meeting transcript is updated
   ↓
2. Database trigger fires
   ↓
3. Trigger calls trigger_suggest_next_actions_for_meeting()
   ↓
4. Function calls net.http_post() to invoke Edge Function
   ↓ (This is where it was failing - pg_net not enabled)
5. Edge Function receives request
   ↓
6. Claude analyzes transcript
   ↓
7. Suggestions created in database
```

## 🎯 Success Indicators

After enabling pg_net and re-running force generation:

- ✅ SQL shows `triggered = t` (not error objects)
- ✅ Edge Function logs show invocations
- ✅ Database has suggestions: `COUNT(*) > 0`
- ✅ UI displays AI Suggestions badges

## 🚨 If It Still Doesn't Work

### Check Extension Status

```sql
-- List all extensions
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

**Look for**: `pg_net` in the list

### Check Permissions

```sql
-- Verify permissions on net schema
SELECT
  grantee,
  privilege_type
FROM information_schema.schema_privileges
WHERE schema_name = 'net'
ORDER BY grantee;
```

**Should see**: `service_role` and `authenticated` with USAGE

### Check Function Exists

```sql
-- Verify http_post function exists
SELECT
  proname,
  pronargs
FROM pg_proc
WHERE proname = 'http_post'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net');
```

**Should see**: `http_post` with several argument variants

### Manual Test

```sql
-- Test http_post directly
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"test": "data"}'::text
);
```

**Should return**: A response ID (not an error)

## 📝 For Production Deployment

Add this to your deployment checklist:

```bash
# Apply migration that enables pg_net
supabase db push

# Or manually in Supabase Dashboard:
# Settings → Database → Extensions → Enable "pg_net"
```

## 🎓 Why This Happened

The `pg_net` extension is **not enabled by default** in Supabase projects. It must be explicitly enabled. The Next-Actions system requires it for the trigger-based architecture:

- **Trigger system**: Database → HTTP → Edge Function
- **Without pg_net**: Database functions can't make HTTP calls
- **With pg_net**: Full automation works as designed

## 🔄 Migration File Created

The migration file `20251031000002_enable_pg_net_extension.sql` has been created. Apply it:

```bash
# Via CLI
supabase db push

# Or apply manually in SQL Editor
-- (copy contents of migration file)
```

---

**Quick Start**: Run `ENABLE_PG_NET.sql` in Supabase SQL Editor right now, then re-run `force-generate-simple.sql`!
