# Enable pg_net Extension via Supabase Dashboard

## 🚨 Issue

SQL commands to enable `pg_net` may not work if you don't have sufficient permissions. Supabase requires enabling certain extensions through the Dashboard.

## ✅ Solution: Enable via Dashboard (2 minutes)

### Method 1: Supabase Dashboard (Recommended)

1. **Open** your Supabase project dashboard
2. **Navigate** to: **Database** → **Extensions** (left sidebar)
3. **Search** for "pg_net"
4. **Click** the toggle switch to **enable** it
5. **Wait** 10-20 seconds for it to activate

![Enable pg_net](https://supabase.com/docs/img/enable-extension.png)

### Method 2: SQL Editor (if you have permissions)

If Dashboard method doesn't work, try SQL Editor:

```sql
-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Or with default schema
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Method 3: Supabase CLI

```bash
# Enable via CLI
supabase db execute "CREATE EXTENSION IF NOT EXISTS pg_net;"
```

## 🔍 Verify It's Enabled

### Check Extension Status

Run this in SQL Editor:

```sql
-- Should return one row if enabled
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_net';
```

**Expected result**:
```
extname | extversion
--------+-----------
pg_net  | 0.7.3
```

**If nothing returns**: Extension is NOT enabled

### Check Available Extensions

```sql
-- See if pg_net is available
SELECT
  name,
  installed_version,
  CASE
    WHEN installed_version IS NOT NULL THEN '✅ Installed'
    ELSE '❌ Not Installed'
  END as status
FROM pg_available_extensions
WHERE name = 'pg_net';
```

### Check net Schema and Functions

```sql
-- Check if net schema exists
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'net';

-- Check if http_post function exists
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'http_post'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net');
```

## 🎯 After Enabling

### 1. Grant Permissions (Important!)

```sql
-- Grant permissions to service_role
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;
```

### 2. Set Database Configuration

```sql
-- Set Supabase URL (replace with your project URL)
ALTER DATABASE postgres
SET app.settings.supabase_url = 'https://YOUR-PROJECT-REF.supabase.co';

-- Set Service Role Key (get from Dashboard → Settings → API)
ALTER DATABASE postgres
SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
```

**To get your Service Role Key**:
1. Dashboard → Settings → API
2. Copy "service_role" key (under "Project API keys")

### 3. Verify Configuration

```sql
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN '✅ SET'
    ELSE '❌ NOT SET'
  END as service_role_key_status;
```

### 4. Test pg_net

```sql
-- Test HTTP call
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"test": "data"}'::text
);
```

**Should return**: A request ID number (not an error)

### 5. Re-run Force Generation

```sql
-- Now this should work!
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE m.transcript_text IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 5;
```

**Expected result**:
```
id                  | title             | triggered
--------------------+-------------------+----------------------------------
abc-123...          | Amanda Billings   | {"status": 200, "response": ...}
```

✅ Should now show JSON response instead of error!

## 🚨 Troubleshooting

### Issue: Extension toggle not visible in Dashboard

**Possible causes**:
- You're on the free plan (some extensions restricted)
- Project is too old (needs migration)
- Extension not supported in your region

**Solution**: Contact Supabase support or use CLI method

### Issue: Permission denied when enabling extension

**Error**: `permission denied to create extension "pg_net"`

**Solution**:
1. Use Dashboard method (bypasses permission checks)
2. Or contact Supabase support to enable it for your project

### Issue: Extension enabled but functions still fail

**Check**:
1. Did you grant permissions? (See "Grant Permissions" section)
2. Did you set database config? (See "Set Database Configuration")
3. Did you restart connections? (Close and reopen SQL Editor)

### Issue: Database config not persisting

**Problem**: Settings reset after database restart

**Solution**: Use `ALTER DATABASE` instead of `set_config`:

```sql
-- Persistent (survives restarts)
ALTER DATABASE postgres SET app.settings.supabase_url = 'your-url';

-- NOT persistent (session only)
SELECT set_config('app.settings.supabase_url', 'your-url', false);
```

## 📋 Complete Checklist

- [ ] Enable pg_net via Dashboard → Database → Extensions
- [ ] Verify extension: `SELECT * FROM pg_extension WHERE extname = 'pg_net'`
- [ ] Grant permissions to service_role and authenticated
- [ ] Set database config (supabase_url and service_role_key)
- [ ] Verify config: `SELECT current_setting('app.settings.supabase_url', true)`
- [ ] Test pg_net: `SELECT net.http_post(...)`
- [ ] Re-run force generation SQL
- [ ] Check Edge Function logs: `supabase functions logs suggest-next-actions`
- [ ] Verify suggestions created: `SELECT COUNT(*) FROM next_action_suggestions`

## 🎯 Expected Outcome

After completing all steps:

1. ✅ Extension enabled and visible in Dashboard
2. ✅ Permissions granted (no permission errors)
3. ✅ Database config set (settings persist)
4. ✅ Test HTTP call succeeds
5. ✅ Force generation returns JSON (not errors)
6. ✅ Edge Function logs show invocations
7. ✅ Suggestions appear in database
8. ✅ UI displays AI Suggestions badges

## 🔗 Resources

- [Supabase pg_net Documentation](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Enable Extensions Guide](https://supabase.com/docs/guides/database/extensions)
- [Database Configuration](https://supabase.com/docs/guides/database/configuration)

---

**TL;DR**: Go to Dashboard → Database → Extensions → Enable "pg_net" → Grant permissions → Set config → Re-run force generation!
