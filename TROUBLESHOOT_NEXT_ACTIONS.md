# Next-Action Engine Troubleshooting Guide

## Issue: No suggestions appearing after meeting sync

### Quick Diagnostics

Run these SQL queries in Supabase SQL Editor to diagnose the issue:

#### 1. Check Recent Meetings Have Required Data
```sql
-- Check if meetings have transcripts or summaries
SELECT
  id,
  title,
  owner_user_id,
  LENGTH(transcript_text) as transcript_length,
  LENGTH(summary) as summary_length,
  created_at,
  next_actions_count
FROM meetings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: Meetings should have `transcript_length > 0` OR `summary_length > 0`

**If empty**: The trigger won't fire because there's no content to analyze.

---

#### 2. Check Triggers Are Installed and Enabled
```sql
-- Check trigger status
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    WHEN 'R' THEN 'Replica'
    WHEN 'A' THEN 'Always'
  END as status
FROM pg_trigger
WHERE tgname LIKE '%next_action%'
ORDER BY tgname;
```

**Expected**: Should see:
- `trigger_auto_suggest_next_actions_meeting` (enabled = 'O')
- `trigger_auto_suggest_next_actions_activity` (enabled = 'O')

**If missing**: Run migration `20251031120001_create_next_actions_triggers.sql`

---

#### 3. Check Database Configuration
```sql
-- Check database settings for Edge Function calls
SHOW app.settings.supabase_url;
SHOW app.settings.service_role_key;
```

**Expected**: Should return your Supabase project URL and service role key

**If empty**: Configure with:
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

---

#### 4. Check Edge Function Is Deployed
```bash
# Check Edge Function status
supabase functions list

# Check Edge Function logs
supabase functions logs suggest-next-actions --limit 50
```

**Expected**: Function should be listed and deployed

**If missing**: Deploy with:
```bash
supabase functions deploy suggest-next-actions
```

---

#### 5. Verify Environment Variables
Check Supabase Dashboard → Edge Functions → suggest-next-actions → Settings

**Required Environment Variables:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key
- `SUPABASE_ANON_KEY` - Your anon key

---

### Manual Testing

#### Test Edge Function Directly
```sql
-- Find a meeting with content
SELECT
  id,
  title,
  LENGTH(transcript_text) as transcript_length
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- Manually trigger suggestion generation (replace MEETING_ID)
SELECT regenerate_next_actions_for_activity(
  'MEETING_ID'::UUID,
  'meeting'
);
```

**Expected**: Should return a JSON object with `success: true` and `count: X`

**Check Results:**
```sql
-- Check if suggestions were created
SELECT
  id,
  title,
  reasoning,
  urgency,
  status,
  created_at
FROM next_action_suggestions
ORDER BY created_at DESC
LIMIT 5;
```

---

### Common Issues & Solutions

#### Issue 1: Triggers Not Firing
**Symptoms**: Meetings created but no suggestions generated automatically

**Causes**:
1. Triggers not installed
2. Meetings don't have transcript_text or summary
3. Database config missing

**Solution**:
```sql
-- Reinstall triggers
\i supabase/migrations/20251031120001_create_next_actions_triggers.sql

-- Or manually create:
CREATE TRIGGER trigger_auto_suggest_next_actions_meeting
  AFTER INSERT OR UPDATE OF transcript_text, summary ON meetings
  FOR EACH ROW
  WHEN (NEW.transcript_text IS NOT NULL OR NEW.summary IS NOT NULL)
  EXECUTE FUNCTION trigger_suggest_next_actions_for_meeting();
```

---

#### Issue 2: Edge Function Fails Silently
**Symptoms**: Trigger fires but no suggestions created

**Causes**:
1. ANTHROPIC_API_KEY not set or invalid
2. Edge Function not deployed
3. Edge Function errors (check logs)

**Solution**:
```bash
# Check Edge Function logs for errors
supabase functions logs suggest-next-actions --limit 100

# Look for errors like:
# - "ANTHROPIC_API_KEY not set"
# - "Failed to fetch"
# - "Unauthorized"

# Redeploy if needed
supabase functions deploy suggest-next-actions
```

---

#### Issue 3: pg_net Extension Issues
**Symptoms**: Error "extension pg_net not available"

**Solution**:
```sql
-- Check if pg_net is installed
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- If missing, install (requires superuser or Supabase support)
-- Contact Supabase support to enable pg_net
```

---

#### Issue 4: RLS Policies Blocking Access
**Symptoms**: Suggestions created but not visible in app

**Solution**:
```sql
-- Check your user ID
SELECT auth.uid();

-- Check suggestions for your user
SELECT
  id,
  title,
  user_id,
  status
FROM next_action_suggestions
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- If empty, check if suggestions exist for other users
SELECT
  COUNT(*),
  user_id
FROM next_action_suggestions
GROUP BY user_id;
```

---

### Backfill Suggestions for Existing Meetings

If you have existing meetings with transcripts and want to generate suggestions:

```sql
-- Backfill last 10 meetings
SELECT backfill_next_actions_for_meetings(10);

-- Check progress
SELECT
  COUNT(*) as total_suggestions,
  COUNT(DISTINCT activity_id) as meetings_with_suggestions
FROM next_action_suggestions;
```

---

### Debug Checklist

Run through this checklist:

- [ ] Migrations loaded (both schema and triggers)
- [ ] Database settings configured (supabase_url, service_role_key)
- [ ] Edge Function deployed
- [ ] Environment variables set (ANTHROPIC_API_KEY, etc.)
- [ ] Meetings have transcript_text or summary
- [ ] Triggers are enabled
- [ ] pg_net extension installed
- [ ] Edge Function logs show no errors
- [ ] Manual test with `regenerate_next_actions_for_activity` works
- [ ] Suggestions visible in database
- [ ] RLS policies allow user access

---

### Get Support

If issues persist, collect this information:

```sql
-- System info
SELECT version();
SELECT * FROM pg_extension WHERE extname IN ('pg_net', 'http');

-- Recent meetings
SELECT id, title, created_at,
       LENGTH(transcript_text) as has_transcript,
       next_actions_count
FROM meetings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC LIMIT 5;

-- Trigger status
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%next_action%';

-- Recent suggestions
SELECT id, title, status, created_at, user_id
FROM next_action_suggestions
ORDER BY created_at DESC LIMIT 5;
```

Check Edge Function logs:
```bash
supabase functions logs suggest-next-actions --limit 100
```

---

## Quick Fix: Force Generation

If you need to force generation for a specific meeting:

```sql
-- Get meeting ID
SELECT id, title FROM meetings WHERE transcript_text IS NOT NULL LIMIT 1;

-- Force regeneration (replace with actual meeting ID)
SELECT regenerate_next_actions_for_activity(
  'YOUR-MEETING-ID-HERE'::UUID,
  'meeting'
);

-- Verify suggestions created
SELECT * FROM next_action_suggestions
WHERE activity_id = 'YOUR-MEETING-ID-HERE'::UUID;
```

---

## Monitoring Query

Use this to monitor suggestion generation:

```sql
-- Daily suggestion generation stats
SELECT
  DATE(created_at) as date,
  COUNT(*) as suggestions_created,
  COUNT(DISTINCT activity_id) as activities_with_suggestions,
  COUNT(DISTINCT user_id) as users_with_suggestions,
  SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
  SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
FROM next_action_suggestions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```
