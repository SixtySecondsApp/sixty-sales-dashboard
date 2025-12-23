# Final Setup Guide - Next-Actions System

## 🎯 Complete Setup in 5 Steps

You've encountered permission issues with `ALTER DATABASE`. This guide uses a **configuration table** instead, which doesn't require special permissions.

---

## Step 1: Enable pg_net Extension (Dashboard)

### Via Supabase Dashboard:
1. Open your Supabase project
2. Go to: **Database** → **Extensions**
3. Search for "pg_net"
4. Toggle the switch to **enable** it
5. Wait 10-20 seconds

### Verify it's enabled:
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';
```

**Expected**: One row showing `pg_net | 0.7.3`

---

## Step 2: Apply Migration (Create Config Table)

### Via Supabase SQL Editor:

Copy and paste the contents of `supabase/migrations/20251031000003_create_system_config_table.sql`

Or run:
```bash
supabase db push
```

### What this does:
- Creates `system_config` table to store Supabase URL and service role key
- Updates functions to read from this table instead of database settings
- No special permissions required!

### Verify table created:
```sql
SELECT * FROM system_config;
```

**Expected**: 2 rows with placeholder values

---

## Step 3: Set Your Configuration

### Get Your Credentials:

1. **Supabase URL**:
   - Dashboard → Settings → API
   - Copy "Project URL" (e.g., `https://abc123xyz.supabase.co`)

2. **Service Role Key**:
   - Dashboard → Settings → API
   - Copy "service_role" key (under "Project API keys")
   - ⚠️ **Keep this secret!** Don't commit to git

### Update Configuration:

```sql
-- Update Supabase URL (replace with your actual URL)
UPDATE system_config
SET value = 'https://YOUR-PROJECT-REF.supabase.co',
    updated_at = NOW()
WHERE key = 'supabase_url';

-- Update Service Role Key (replace with your actual key)
UPDATE system_config
SET value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...YOUR-KEY',
    updated_at = NOW()
WHERE key = 'service_role_key';
```

### Verify it's set:
```sql
SELECT
  key,
  CASE
    WHEN key = 'supabase_url' THEN value
    WHEN key = 'service_role_key' THEN
      CASE
        WHEN value = 'placeholder-key' THEN '❌ NOT SET'
        ELSE '✅ SET (hidden)'
      END
  END as value_status
FROM system_config
ORDER BY key;
```

**Expected output**:
```
key                | value_status
-------------------+----------------------------------
service_role_key   | ✅ SET (hidden)
supabase_url       | https://abc123xyz.supabase.co
```

---

## Step 4: Grant pg_net Permissions

```sql
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;
```

---

## Step 5: Test the System

### Test 1: Verify Configuration
```sql
-- Test config retrieval
SELECT get_system_config('supabase_url');
SELECT get_system_config('service_role_key');
```

**Should return**: Your actual values (not placeholders)

### Test 2: Test pg_net
```sql
-- Test HTTP call
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"test": "data"}'::text
);
```

**Should return**: A request ID number

### Test 3: Force Generate Suggestions
```sql
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE m.transcript_text IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 3;
```

**Expected output**:
```json
{
  "id": "abc-123...",
  "title": "Amanda Billings",
  "triggered": {
    "status": 200,
    "response": {"success": true, "suggestionsCreated": 3}
  }
}
```

✅ **If you see JSON with status 200** = SUCCESS!

### Test 4: Check Edge Function Logs
```bash
supabase functions logs suggest-next-actions --limit 50
```

**Should see**:
```
INFO | Received request: {"activityId":"abc-123..."}
INFO | Fetching meeting from database...
INFO | Analyzing transcript (1,234 chars) with Claude...
INFO | Claude returned 3 suggestions
INFO | Created 3 suggestions in database
```

### Test 5: Verify Suggestions Created
```sql
SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting';
```

**Expected**: 6-15 suggestions (2-5 per meeting × 3 meetings)

### Test 6: Check UI
1. Open your app
2. Go to any meeting detail page
3. Look for "AI Suggestions" badge
4. Click to open panel
5. Verify suggestions appear

---

## 🎉 Success Checklist

After completing all steps, verify:

- [x] **Step 1**: pg_net extension enabled
- [x] **Step 2**: system_config table created
- [x] **Step 3**: Configuration values updated
- [x] **Step 4**: Permissions granted
- [x] **Step 5**: All tests pass

**Final verification**:
```sql
-- All-in-one status check
SELECT
  (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_net') as pg_net_enabled,
  (SELECT COUNT(*) FROM system_config) as config_rows,
  (SELECT COUNT(*) FROM system_config WHERE value NOT LIKE 'placeholder%') as config_set,
  (SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting') as suggestions_created;
```

**Expected**:
```
pg_net_enabled | config_rows | config_set | suggestions_created
---------------+-------------+------------+--------------------
             1 |           2 |          2 |                 15
```

All numbers > 0 = ✅ **SYSTEM FULLY OPERATIONAL**

---

## 🚨 Troubleshooting

### Issue: pg_net extension fails to enable

**Error**: "Extension not available"

**Solution**:
- Contact Supabase support
- Check if your plan supports pg_net
- Try older project or different region

### Issue: Configuration table not created

**Error**: "relation system_config does not exist"

**Solution**:
1. Copy full migration file contents
2. Paste into SQL Editor
3. Run manually
4. Check for errors in output

### Issue: Permission denied on system_config

**Error**: "permission denied for table system_config"

**Solution**:
```sql
-- Grant permissions
GRANT SELECT ON system_config TO authenticated;
GRANT ALL ON system_config TO service_role;
```

### Issue: Force generation still returns errors

**Check 1**: Is pg_net enabled?
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

**Check 2**: Are config values set correctly?
```sql
SELECT * FROM system_config;
```

**Check 3**: Can functions read config?
```sql
SELECT get_system_config('supabase_url');
```

**Check 4**: Test HTTP directly
```sql
SELECT net.http_post(
  url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || get_system_config('service_role_key')
  ),
  body := '{"test": true}'::text
);
```

### Issue: Edge Function never receives requests

**Possible causes**:
1. Wrong Supabase URL in config
2. Wrong service role key
3. Edge Function not deployed
4. pg_net permissions not granted

**Debug**:
```sql
-- Check config values (safely)
SELECT
  key,
  LEFT(value, 30) || '...' as value_preview,
  LENGTH(value) as value_length
FROM system_config;

-- Supabase URL should be ~35 chars
-- Service role key should be ~200+ chars
```

---

## 📋 Quick Reference

### Get config value:
```sql
SELECT get_system_config('supabase_url');
```

### Update config value:
```sql
UPDATE system_config SET value = 'new-value' WHERE key = 'supabase_url';
```

### Check pg_net status:
```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_net';
```

### Force generate for all meetings:
```sql
SELECT regenerate_next_actions_for_activity(id, 'meeting')
FROM meetings
WHERE transcript_text IS NOT NULL;
```

### Check suggestions count:
```sql
SELECT COUNT(*) FROM next_action_suggestions;
```

### View recent suggestions:
```sql
SELECT * FROM next_action_suggestions
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `SET_SYSTEM_CONFIG.sql` | Quick SQL to update config |
| `check-pg-net-status.sql` | Verify pg_net is enabled |
| `force-generate-simple.sql` | Test generation for all meetings |
| `ENABLE_PG_NET_DASHBOARD.md` | Detailed pg_net setup guide |

---

**🎯 Bottom Line**: Run the migration, set your config values in the table, and you're good to go! No special permissions needed. 🚀
