# Quick Start: Testing Next-Actions System

## 🎯 Goal
Verify the Next-Actions system is generating AI suggestions from meeting transcripts.

## ⚡ Fast Track (5 Minutes)

### Step 1: Check Current State
```bash
psql "$DATABASE_URL" -f diagnose-transcript-status.sql
```

**Look for**:
- ✅ Green checkmarks (✅) = Good status
- ❌ Red X's (❌) = Issues to address

### Step 2: Find a Meeting With Transcript

**Option A - SQL Query**:
```sql
SELECT id, title, fathom_recording_id, LENGTH(transcript_text) as chars
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Option B - psql One-liner**:
```bash
psql "$DATABASE_URL" -c "
SELECT id, title, LENGTH(transcript_text) as transcript_chars
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;"
```

**Copy a meeting ID** from the results.

### Step 3: Check If It Has Suggestions

```bash
# Replace MEETING-ID with your actual meeting ID
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as suggestion_count
FROM next_action_suggestions
WHERE activity_id = 'MEETING-ID'::UUID;"
```

**If count = 0**: Continue to Step 4
**If count > 0**: ✅ System working! Check UI to see suggestions

### Step 4: Manually Trigger Generation

```bash
# Replace MEETING-ID with your actual meeting ID
psql "$DATABASE_URL" -c "
SELECT regenerate_next_actions_for_activity(
  'MEETING-ID'::UUID,
  'meeting'
);"
```

**Expected output**:
```
 regenerate_next_actions_for_activity
-------------------------------------
 t
(1 row)
```

### Step 5: Verify Suggestions Created

```bash
# Wait 30-60 seconds for Edge Function to complete, then:
psql "$DATABASE_URL" -c "
SELECT id, title, urgency, status, reasoning
FROM next_action_suggestions
WHERE activity_id = 'MEETING-ID'::UUID
ORDER BY created_at DESC;"
```

**Expected output**:
```
                  id                  |           title            | urgency | status  |     reasoning
--------------------------------------+---------------------------+---------+---------+------------------
 123e4567-e89b-12d3-a456-426614174000 | Schedule follow-up call   | high    | pending | Customer showed...
 234e5678-f90c-23d4-b567-537725285111 | Send pricing proposal     | medium  | pending | Discussed pricing...
```

✅ **Success!** Suggestions are being generated.

### Step 6: View in UI

1. Open the app in browser
2. Go to Meetings page
3. Click on the meeting you tested
4. You should see AI suggestions in the meeting detail view

## 🚨 Common Issues & Solutions

### Issue 1: No Meetings With Transcripts

**Symptom**: Step 2 returns 0 rows

**Cause**: Meetings synced but transcripts not yet fetched

**Solution**:
1. Check Fathom to ensure recordings are fully processed
2. Wait 5-10 minutes after sync
3. Run another sync: Settings → Integrations → Fathom → Sync Now
4. Check again

**Why**: Transcripts are fetched separately from meetings. Initial sync creates meeting records with `transcript_text: NULL`, then subsequent syncs fetch transcripts.

### Issue 2: Manual Trigger Returns False

**Symptom**: `regenerate_next_actions_for_activity` returns `f` instead of `t`

**Causes**:
1. Meeting has no transcript or summary
2. Database config not set (service role key)
3. Meeting ID doesn't exist

**Check config**:
```bash
psql "$DATABASE_URL" -f check-db-config.sql
```

**If config missing**, set it:
```bash
# Get your project URL and service role key from Supabase dashboard
psql "$DATABASE_URL" -c "
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';"
```

### Issue 3: Edge Function Not Deployed

**Symptom**: Trigger succeeds but no suggestions appear

**Check deployment**:
```bash
supabase functions list | grep suggest-next-actions
```

**If not deployed**:
```bash
supabase functions deploy suggest-next-actions
```

**Set secrets**:
```bash
supabase secrets set ANTHROPIC_API_KEY=your-key
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Issue 4: Suggestions Generated But Not Visible in UI

**Symptom**: SQL shows suggestions but UI doesn't display them

**Checks**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Check browser console for errors (F12 → Console tab)
3. Verify real-time subscription is connected

**Debug query**:
```sql
-- Check if suggestions exist for this user
SELECT
  nas.id,
  nas.title,
  nas.status,
  nas.activity_id,
  m.title as meeting_title,
  m.owner_user_id
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
WHERE nas.status = 'pending'
ORDER BY nas.created_at DESC
LIMIT 10;
```

## 📊 Health Check Dashboard

Run this comprehensive check:

```bash
psql "$DATABASE_URL" << 'EOF'
-- HEALTH CHECK DASHBOARD
\echo '=== NEXT-ACTIONS SYSTEM HEALTH CHECK ==='
\echo ''

\echo '1. MEETINGS STATUS'
SELECT
  COUNT(*) FILTER (WHERE transcript_text IS NOT NULL) as "Meetings With Transcript",
  COUNT(*) FILTER (WHERE transcript_text IS NULL) as "Meetings Without Transcript",
  COUNT(*) as "Total Meetings"
FROM meetings;

\echo ''
\echo '2. SUGGESTIONS STATUS'
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as "Pending Suggestions",
  COUNT(*) FILTER (WHERE status = 'accepted') as "Accepted",
  COUNT(*) FILTER (WHERE status = 'dismissed') as "Dismissed",
  COUNT(*) as "Total Suggestions"
FROM next_action_suggestions;

\echo ''
\echo '3. TRIGGER STATUS'
SELECT
  trigger_name as "Trigger Name",
  CASE
    WHEN trigger_name IS NOT NULL THEN '✅ Active'
    ELSE '❌ Missing'
  END as "Status"
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_suggest_next_actions_meeting'
LIMIT 1;

\echo ''
\echo '4. DATABASE CONFIG'
SELECT
  CASE
    WHEN current_setting('app.settings.supabase_url', true) IS NOT NULL
    THEN '✅ Configured'
    ELSE '❌ Not Set'
  END as "Supabase URL",
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN '✅ Configured'
    ELSE '❌ Not Set'
  END as "Service Role Key";

\echo ''
\echo '5. RECENT ACTIVITY'
SELECT
  nas.created_at as "Generated At",
  nas.title as "Suggestion",
  m.title as "For Meeting"
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
ORDER BY nas.created_at DESC
LIMIT 5;

EOF
```

## 🎯 Success Criteria

You know the system is working when:

- ✅ Health check shows:
  - Meetings with transcripts > 0
  - Trigger status = Active
  - Database config = Configured
- ✅ Manual trigger returns `t` (true)
- ✅ SQL query shows suggestions for test meeting
- ✅ UI displays AI suggestions badge/panel
- ✅ Accept/Dismiss actions work
- ✅ Accepted suggestions create tasks

## 🚀 Production Deployment Checklist

- [ ] All migrations applied (`20251030000001_create_next_actions_system.sql`, etc.)
- [ ] Edge Function deployed (`suggest-next-actions`)
- [ ] Edge Function secrets configured (ANTHROPIC_API_KEY, etc.)
- [ ] Database config set (supabase_url, service_role_key)
- [ ] Triggers verified active (`trigger_auto_suggest_next_actions_meeting`)
- [ ] Health check passes all checks
- [ ] Manual trigger test successful
- [ ] UI integration verified in dev environment
- [ ] Fathom webhook configured (optional but recommended)
- [ ] Error monitoring configured (Sentry, LogRocket, etc.)

## 📞 Need Help?

1. **Check logs**:
   ```bash
   supabase functions logs suggest-next-actions --limit 50
   ```

2. **Run diagnostics**:
   ```bash
   psql "$DATABASE_URL" -f diagnose-transcript-status.sql
   ```

3. **Review documentation**:
   - `NEXT_ACTIONS_TRANSCRIPT_FLOW.md` - Complete flow analysis
   - `TROUBLESHOOT_NEXT_ACTIONS.md` - Troubleshooting guide
   - `NEXT_ACTIONS_DEPLOYMENT_STATUS.md` - Current status report

4. **Test Edge Function directly**:
   ```bash
   ./test-next-actions.sh
   ```

---

**Expected Time to First Suggestions**: 5-15 minutes after meeting sync, depending on Fathom's transcript processing time.
