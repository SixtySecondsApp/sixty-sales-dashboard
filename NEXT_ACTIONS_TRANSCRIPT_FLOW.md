# Next-Actions Transcript Flow Analysis

## 🔍 Root Cause Identified

**Issue**: No Next-Action suggestions being generated after meeting sync.

**Root Cause**: Meetings are synced **WITHOUT transcripts initially**. Transcripts are fetched separately in a deferred process, and the Next-Action triggers only fire when `transcript_text` or `summary` fields are populated.

## 📊 Data Flow Analysis

### Phase 1: Initial Meeting Sync (fathom-sync)

When you run a meeting sync, here's what happens:

```typescript
// Line 1217-1222 in fathom-sync/index.ts
let summaryText: string | null = call.default_summary || null
let transcriptText: string | null = null

console.log(`📝 Summary from bulk API: ${summaryText ? 'available' : 'not available'}`)
console.log(`📄 Transcript: Not fetched during sync`)
```

**Initial Meeting Record** (lines 1225-1254):
- ✅ Meeting metadata (title, start time, duration, etc.)
- ✅ Summary (if available from bulk API - `call.default_summary`)
- ❌ **`transcript_text: null`** - **NOT FETCHED**

### Phase 2: Deferred Transcript Fetching

**Automatic Attempt** (lines 1270-1272):
```typescript
// AUTO-FETCH TRANSCRIPT AND SUMMARY
await autoFetchTranscriptAndAnalyze(supabase, ownerUserId, integration, meeting, call)
```

This function (`autoFetchTranscriptAndAnalyze`, lines 814-1008) attempts to:

1. **Check if transcript exists** (line 833)
2. **Apply cooldown logic** - 5 minute wait between attempts (lines 856-866)
3. **Fetch transcript from Fathom API** (lines 872-892)
4. **Store transcript in database** (lines 905-911)
5. **Run Claude AI analysis** (lines 917-1001)

**Key Constraints**:
- Max 3 attempts per meeting (lines 824-829)
- 5-minute cooldown between attempts (lines 856-866)
- Only attempts if `transcript_text` is NULL

### Phase 3: Database Trigger Activation

**Trigger Definition** (from migration `20251030000001_create_next_actions_system.sql`):
```sql
CREATE TRIGGER trigger_auto_suggest_next_actions_meeting
  AFTER INSERT OR UPDATE OF transcript_text, summary ON meetings
  FOR EACH ROW
  WHEN (NEW.transcript_text IS NOT NULL OR NEW.summary IS NOT NULL)
  EXECUTE FUNCTION trigger_suggest_next_actions_for_meeting();
```

**Critical Conditions**:
- ✅ Fires on `INSERT` with transcript
- ✅ Fires on `UPDATE OF transcript_text`
- ✅ Fires on `UPDATE OF summary`
- ✅ Only when `transcript_text IS NOT NULL OR summary IS NOT NULL`

## 🔄 Complete Flow Diagram

```
User Action: Sync Meetings
         ↓
┌────────────────────────────────────────────┐
│  Step 1: fathom-sync Edge Function        │
│  - Fetches meetings from Fathom API       │
│  - Creates meeting record                  │
│  - transcript_text: NULL ❌                │
│  - summary: call.default_summary or NULL   │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│  Step 2: autoFetchTranscriptAndAnalyze    │
│  - Attempts to fetch transcript            │
│  - May fail if Fathom still processing    │
│  - Has 5-min cooldown between attempts    │
│  - Max 3 attempts per meeting             │
└────────────────────────────────────────────┘
         ↓ (if transcript fetch succeeds)
┌────────────────────────────────────────────┐
│  Step 3: Update meetings table            │
│  UPDATE meetings                           │
│  SET transcript_text = 'fetched text'     │
│  WHERE id = meeting.id                    │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│  Step 4: Database Trigger Fires 🔥        │
│  trigger_auto_suggest_next_actions_meeting │
│  - ONLY if transcript_text IS NOT NULL    │
│  - Calls suggest-next-actions Edge Fn     │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│  Step 5: Next-Action Suggestions Created  │
│  - Claude analyzes transcript              │
│  - Creates records in next_action_suggestions │
│  - User sees AI suggestions in UI ✅       │
└────────────────────────────────────────────┘
```

## ⚠️ Why Suggestions Weren't Generated

Based on the flow above, suggestions failed because:

1. **Initial Sync**: Meeting created with `transcript_text: NULL`
2. **Trigger Didn't Fire**: `WHEN (NEW.transcript_text IS NOT NULL)` condition NOT met
3. **Auto-Fetch May Have Failed**:
   - Fathom API returned 404 (transcript not ready yet)
   - Cooldown period active (5 minutes between attempts)
   - Max attempts reached (3 attempts total)

## 🧪 Diagnostic Steps

### Check 1: Verify Meeting Has Transcript

```sql
-- Check if any meetings have transcripts
SELECT
  id,
  title,
  fathom_recording_id,
  transcript_text IS NOT NULL as has_transcript,
  LENGTH(transcript_text) as transcript_length,
  summary IS NOT NULL as has_summary,
  transcript_fetch_attempts,
  last_transcript_fetch_at,
  created_at
FROM meetings
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results**:
- ❌ **If `has_transcript = false`**: Transcript not fetched yet
- ✅ **If `has_transcript = true`**: Transcript exists, trigger should have fired

### Check 2: Verify Trigger Configuration

```sql
-- Check if trigger exists and is enabled
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%next_actions%';
```

### Check 3: Check Edge Function Invocation Logs

```bash
# Check Edge Function logs for trigger invocations
supabase functions logs suggest-next-actions --limit 50
```

**Look for**:
- ✅ Function invocations with `activityType: "meeting"`
- ❌ No invocations → trigger not firing
- ❌ Error logs → Edge Function failing

### Check 4: Manual Transcript Fetch Status

```sql
-- Check transcript fetch attempt status
SELECT
  id,
  title,
  fathom_recording_id,
  transcript_fetch_attempts,
  last_transcript_fetch_at,
  EXTRACT(EPOCH FROM (NOW() - last_transcript_fetch_at))/60 as minutes_since_last_fetch
FROM meetings
WHERE transcript_text IS NULL
ORDER BY created_at DESC;
```

**Interpretation**:
- `transcript_fetch_attempts = 0`: No fetch attempted yet
- `transcript_fetch_attempts = 1-2`: In progress, may retry
- `transcript_fetch_attempts = 3`: Max attempts reached, won't retry
- `minutes_since_last_fetch < 5`: Cooldown active, won't retry yet

## 🔧 Solutions

### Solution 1: Wait for Automatic Retry

**When to use**: Transcript is processing on Fathom's side

**Action**: Wait 5+ minutes and run sync again
```bash
# Trigger another sync (will retry transcript fetch)
# Via UI: Settings → Integrations → Fathom → Sync Now
```

### Solution 2: Manual Trigger for Existing Transcripts

**When to use**: Meeting has transcript but no suggestions

```sql
-- Find meetings with transcripts but no suggestions
SELECT m.id, m.title, m.fathom_recording_id
FROM meetings m
LEFT JOIN next_action_suggestions nas ON nas.activity_id = m.id
WHERE m.transcript_text IS NOT NULL
  AND nas.id IS NULL
ORDER BY m.created_at DESC
LIMIT 10;

-- Manually trigger suggestion generation
SELECT regenerate_next_actions_for_activity(
  'YOUR-MEETING-ID-HERE'::UUID,
  'meeting'
);
```

### Solution 3: Reset Fetch Attempts

**When to use**: Fetch attempts maxed out but you want to retry

```sql
-- Reset fetch attempts for a specific meeting
UPDATE meetings
SET
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL
WHERE fathom_recording_id = 'YOUR-RECORDING-ID';

-- Then run sync again to retry fetch
```

### Solution 4: Check Fathom Webhook

**When to use**: Want real-time transcript sync

The fathom-webhook (`/supabase/functions/fathom-webhook/index.ts`) should:
1. Receive webhook from Fathom when recording is ready
2. Call fathom-sync with `sync_type: 'webhook'`
3. Auto-fetch transcript and trigger suggestions

**Verify webhook is configured**:
- Fathom Dashboard → Settings → Webhooks
- Webhook URL: `https://YOUR-PROJECT.supabase.co/functions/v1/fathom-webhook`
- Events: `recording.ready` or similar

## 📈 Expected Timeline

For a typical meeting flow:

```
T+0min:  Meeting ends
T+1min:  Fathom starts processing recording
T+5min:  Fathom completes transcription
T+5min:  Webhook fires (if configured)
         OR
T+5min:  Next sync fetches transcript
T+6min:  Database trigger fires
T+7min:  suggest-next-actions Edge Function completes
T+7min:  Suggestions visible in UI ✅
```

**Delays can occur if**:
- Fathom processing takes longer (long meetings)
- Webhook not configured (manual sync required)
- Cooldown period active (5 min between attempts)

## 🎯 Recommended Testing Approach

1. **Find a meeting with transcript**:
   ```sql
   SELECT id, title, fathom_recording_id
   FROM meetings
   WHERE transcript_text IS NOT NULL
   LIMIT 1;
   ```

2. **Check if it has suggestions**:
   ```sql
   SELECT COUNT(*)
   FROM next_action_suggestions
   WHERE activity_id = 'YOUR-MEETING-ID'::UUID;
   ```

3. **If no suggestions, manually trigger**:
   ```sql
   SELECT regenerate_next_actions_for_activity(
     'YOUR-MEETING-ID'::UUID,
     'meeting'
   );
   ```

4. **Verify suggestions created**:
   ```sql
   SELECT id, title, urgency, status, reasoning
   FROM next_action_suggestions
   WHERE activity_id = 'YOUR-MEETING-ID'::UUID
   ORDER BY created_at DESC;
   ```

## 🚀 Next Steps

1. **Run Check 1 SQL** to see if any meetings have transcripts
2. **If yes**: Manually trigger generation for one meeting
3. **If no**: Wait for next sync cycle or check Fathom processing status
4. **Configure webhook** for real-time transcript sync (optional but recommended)

---

**Status**: This is the expected behavior. Transcripts are deferred to reduce API calls and processing time. The system will automatically generate suggestions once transcripts are available.
