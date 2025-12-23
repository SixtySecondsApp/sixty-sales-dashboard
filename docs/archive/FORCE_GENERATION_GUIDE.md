# Force Generation Guide - Testing Next-Actions System

## 🎯 Goal
Force the `suggest-next-actions` Edge Function to run for all meetings with transcripts, generating logs and creating suggestions.

## 🚀 Three Methods to Choose From

### Method 1: Simplest - SQL Editor (Recommended)

**Best for**: Quick testing, no command line needed

**Steps**:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `force-generate-simple.sql`
3. Paste and click "Run"
4. Wait 30 seconds
5. Check results:
   ```sql
   SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting';
   ```

**What it does**:
```sql
-- Triggers generation for ALL meetings with transcripts
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE m.transcript_text IS NOT NULL;
```

**Expected output**:
```
id                                    | title                      | triggered
--------------------------------------+----------------------------+-----------
123e4567-e89b-12d3-a456-426614174000 | Sales Call with Acme Corp  | t
234e5678-f90c-23d4-b567-537725285111 | Demo for Tech Startup      | t
```

### Method 2: Advanced SQL with Progress Tracking

**Best for**: Detailed feedback, error handling, progress reporting

**Steps**:
```bash
# Run with progress tracking
psql "$DATABASE_URL" -f force-generate-all.sql
```

**What it does**:
- Lists all meetings that will be processed
- Triggers generation for each meeting with 2-second delay
- Reports success/failure for each meeting
- Shows summary statistics at the end
- Displays recent suggestions created

**Expected output**:
```
=========================================
MEETINGS WITH TRANSCRIPTS (WILL PROCESS)
=========================================

Processing: Sales Call with Acme Corp (ID: 123e4567...)
✅ Success: Sales Call with Acme Corp

Processing: Demo for Tech Startup (ID: 234e5678...)
✅ Success: Demo for Tech Startup

=========================================
GENERATION COMPLETE
=========================================
Successfully triggered: 2
Errors: 0
```

### Method 3: CLI-Based Direct Invocation

**Best for**: Testing Edge Function directly, bypassing database triggers

**Steps**:
```bash
# Make executable (first time only)
chmod +x force-generate-via-cli.sh

# Run the script
./force-generate-via-cli.sh
```

**What it does**:
- Fetches all meeting IDs with transcripts from database
- Directly invokes `suggest-next-actions` Edge Function via Supabase CLI
- Shows live progress for each invocation
- Checks response for success/failure
- Displays summary and recent suggestions
- **Generates Edge Function logs** for debugging

**Expected output**:
```
=========================================
Force Generate Next-Actions via CLI
=========================================

📋 Step 1: Finding meetings with transcripts...
✅ Found 5 meetings with transcripts

📋 Step 2: Invoking Edge Function for each meeting...

Processing: 123e4567-e89b-12d3-a456-426614174000
✅ Success

Processing: 234e5678-f90c-23d4-b567-537725285111
✅ Success

=========================================
GENERATION COMPLETE
=========================================
Successfully triggered: 5
Errors: 0

📋 Step 3: Checking results...
Total suggestions in database: 15
```

## 🔍 After Running: Check Results

### 1. Check Edge Function Logs

```bash
supabase functions logs suggest-next-actions --limit 50
```

**What to look for**:
- ✅ Function invocations showing `activityType: "meeting"`
- ✅ Claude API calls with transcript analysis
- ✅ Suggestions being created in database
- ❌ Errors or failures

**Expected log output**:
```
2025-10-31 12:34:56 | INFO | Received request: {"activityId":"123e4567...","activityType":"meeting"}
2025-10-31 12:34:57 | INFO | Fetching meeting from database...
2025-10-31 12:34:57 | INFO | Analyzing transcript (1,234 chars) with Claude...
2025-10-31 12:35:02 | INFO | Claude returned 3 suggestions
2025-10-31 12:35:03 | INFO | Created 3 suggestions in database
2025-10-31 12:35:03 | INFO | Response: {"success":true,"suggestionsCreated":3}
```

### 2. Check Database for Suggestions

```sql
-- Count suggestions by status
SELECT
  status,
  COUNT(*) as count
FROM next_action_suggestions
WHERE activity_type = 'meeting'
GROUP BY status;

-- View recent suggestions
SELECT
  nas.id,
  nas.title,
  nas.urgency,
  nas.status,
  m.title as meeting_title,
  nas.created_at
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
WHERE nas.activity_type = 'meeting'
ORDER BY nas.created_at DESC
LIMIT 10;
```

### 3. Check UI

1. Open your app in browser
2. Navigate to any meeting detail page
3. Look for AI Suggestions badge/panel
4. Verify suggestions appear and are actionable

## ⚡ Quick Troubleshooting

### Issue: No meetings with transcripts

**Symptom**: Script says "No meetings found with transcripts"

**Check**:
```sql
SELECT
  COUNT(*) as total_meetings,
  COUNT(*) FILTER (WHERE transcript_text IS NOT NULL) as with_transcript
FROM meetings;
```

**If total_meetings = 0**: Run meeting sync first
**If with_transcript = 0**: Wait 5-10 minutes after sync, then sync again

### Issue: triggered = f (false)

**Symptom**: Script shows `triggered | f` instead of `triggered | t`

**Causes**:
1. Database config not set
2. Meeting has no transcript
3. Edge Function not deployed

**Check config**:
```bash
psql "$DATABASE_URL" -f check-db-config.sql
```

**Fix**:
```sql
-- Set database config
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
```

### Issue: Edge Function errors in logs

**Symptom**: Logs show errors like "Failed to fetch meeting" or "Claude API error"

**Check secrets**:
```bash
supabase secrets list | grep -E "ANTHROPIC_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
```

**Fix missing secrets**:
```bash
supabase secrets set ANTHROPIC_API_KEY=your-key
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Issue: Suggestions created but not visible in UI

**Symptom**: Database shows suggestions, but UI doesn't display them

**Fixes**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Check browser console for errors (F12)
3. Verify real-time subscription is connected
4. Check if suggestions belong to current user

**Debug query**:
```sql
-- Check suggestions with user info
SELECT
  nas.id,
  nas.title,
  nas.status,
  m.title as meeting_title,
  m.owner_user_id,
  p.email as owner_email
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
LEFT JOIN profiles p ON p.id = m.owner_user_id
WHERE nas.activity_type = 'meeting'
ORDER BY nas.created_at DESC
LIMIT 10;
```

## 📊 Expected Results

After running force-generation:

### Database
```sql
-- Should show suggestions
SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting';
-- Expected: 2-5 suggestions per meeting (so 10-25 total for 5 meetings)
```

### Edge Function Logs
```bash
supabase functions logs suggest-next-actions --limit 20
# Should show 5-10+ invocations with successful responses
```

### UI
- Meeting detail pages show AI Suggestions badge
- Badge shows pending count (e.g., "3 suggestions")
- Clicking badge opens NextActionPanel
- Panel shows suggestion cards with Accept/Dismiss buttons
- Real-time updates work (no refresh needed)

## 🎯 Success Criteria

You know force-generation worked when:

- ✅ Script completes with `Successfully triggered: N` (N > 0)
- ✅ Edge Function logs show invocations and Claude API calls
- ✅ Database query returns suggestions: `COUNT(*) > 0`
- ✅ UI displays AI Suggestions badge on meeting pages
- ✅ Clicking badge shows suggestion cards
- ✅ Accept button creates tasks in database

## 🔄 Re-running Force Generation

**Safe to re-run**: All scripts check for existing suggestions and use `forceRegenerate: true` flag

**What happens**:
1. Old suggestions for that meeting are **dismissed automatically**
2. New suggestions are generated and marked as **pending**
3. No duplicate suggestions are created
4. Users see fresh AI recommendations

**When to re-run**:
- Testing after Edge Function code changes
- Transcript was updated/improved
- Want fresh suggestions based on new prompt engineering

## 📞 Next Steps After Force Generation

1. **Check logs**: `supabase functions logs suggest-next-actions --limit 50`
2. **Verify database**: Run diagnostics SQL queries above
3. **Test UI**: Open app and interact with suggestions
4. **Test actions**: Accept a suggestion → verify task created
5. **Test real-time**: Open two browser windows → accept in one → verify update in other

---

**Quick Start**: Just run `force-generate-simple.sql` in Supabase SQL Editor and check the logs!
