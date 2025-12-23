# CRITICAL: Enable pg_net Extension

## 🚨 Current Status

**pg_net Extension**: ❌ **NOT ENABLED**

**Evidence**: All force-generation attempts fail with:
```
"function net.http_post(...) does not exist"
```

**Config Table**: ✅ Working (URL and key are set)
**Problem**: Extension not enabled, so HTTP functions don't exist

---

## ✅ MUST DO: Enable via Supabase Dashboard

### **Step 1: Open Your Project Dashboard**
1. Go to: https://supabase.com/dashboard
2. Click on your project: `ewtuefzeogytgmsnkpmb`

### **Step 2: Navigate to Extensions**
1. In the left sidebar, click **"Database"**
2. Then click **"Extensions"** (under Database section)

### **Step 3: Find and Enable pg_net**
1. In the search box at the top, type: `pg_net`
2. You should see "pg_net" in the list
3. **Click the toggle switch** to enable it (switch should turn green/blue)
4. **Wait 10-20 seconds** for it to activate

### **Step 4: Verify in SQL Editor**
Go back to SQL Editor and run:
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';
```

**Expected result**:
```
extname | extversion
--------+-----------
pg_net  | 0.7.3
```

**If you see this row**: ✅ Extension is enabled! Proceed to Step 5.
**If nothing returns**: ❌ Extension not enabled, try again or contact support.

### **Step 5: Grant Permissions**
```sql
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;
```

### **Step 6: Test Again**
```sql
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE transcript_text IS NOT NULL
LIMIT 3;
```

**Expected**:
```json
{
  "status": 200,
  "response": {"success": true, "suggestionsCreated": 3}
}
```

---

## 🎯 Why Dashboard is Required

**SQL `CREATE EXTENSION` requires superuser privileges** which are restricted in Supabase managed databases.

**The Dashboard has special permissions** to enable extensions safely without giving users superuser access.

**This is by design** for security - prevents users from installing potentially harmful extensions.

---

## 📸 Visual Reference

When you go to Database → Extensions, you should see a page like this:

```
┌─────────────────────────────────────────────────────┐
│ Database Extensions                                  │
│                                                      │
│ Search: [pg_net                         ] 🔍        │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ pg_net                              [ OFF ]  │   │
│ │ Async HTTP client for PostgreSQL     ↑      │   │
│ │                                      Click   │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

After clicking the toggle, it should show **[ ON ]** with a green/blue color.

---

## 🚨 If pg_net is Not in the Extensions List

### Possible Reasons:
1. **Your Supabase plan doesn't include pg_net**
   - Free tier should have it
   - Check plan features

2. **Project is in an older version**
   - May need to be migrated
   - Contact Supabase support

3. **Regional restrictions**
   - Some regions may not have all extensions
   - Try contacting support

### Alternative: Contact Supabase Support
1. Go to: https://supabase.com/dashboard/support
2. Submit a ticket: "Please enable pg_net extension for project ewtuefzeogytgmsnkpmb"
3. They typically respond within 24 hours

---

## 🔧 Troubleshooting

### Can't find Database → Extensions menu?

**Old Dashboard Version**:
- Try: Settings → Database → Extensions
- Or: Configuration → Extensions

**New Dashboard Version**:
- Left sidebar → Database (icon looks like a database symbol)
- Under Database section → Extensions

### Toggle switch doesn't work?

**Browser issues**:
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
- Try different browser
- Clear browser cache

**Permission issues**:
- Ensure you're logged in as project owner
- Check if you have admin access to the project

### Extension enables but SQL still fails?

**Missing permissions**:
```sql
-- Run this after enabling
GRANT USAGE ON SCHEMA net TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO service_role;
```

**Stale connections**:
- Close and reopen SQL Editor
- Wait 30 seconds and try again

---

## ✅ Success Indicators

After enabling pg_net, these should ALL pass:

### Check 1: Extension exists
```sql
SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_net';
-- Should return: 1
```

### Check 2: Schema exists
```sql
SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'net';
-- Should return: 1
```

### Check 3: Function exists
```sql
SELECT COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'net' AND p.proname = 'http_post';
-- Should return: 1 or more
```

### Check 4: HTTP call works
```sql
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"test": true}'::text
);
-- Should return: A request ID number
```

### Check 5: Force generation works
```sql
SELECT regenerate_next_actions_for_activity(
  (SELECT id FROM meetings WHERE transcript_text IS NOT NULL LIMIT 1),
  'meeting'
);
-- Should return: {"status": 200, "response": {...}}
```

---

## 🎯 Bottom Line

**You CANNOT proceed without enabling pg_net via the Dashboard.**

SQL commands won't work due to permission restrictions.

**Go to Dashboard → Database → Extensions → Enable pg_net** (takes 30 seconds!)

---

## 📞 Need Help?

If you still can't enable pg_net after trying the Dashboard:

1. **Screenshot** the Extensions page
2. **Check** your Supabase plan/tier
3. **Contact** Supabase support with your project ref: `ewtuefzeogytgmsnkpmb`
4. **Alternative**: We can redesign the system to use Supabase client-side calls instead of triggers (slower but doesn't need pg_net)

---

**The entire Next-Actions system is ready - it just needs pg_net enabled!** 🚀
