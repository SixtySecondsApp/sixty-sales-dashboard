# Action Item Extraction Analysis

## How Action Items Work - Two Pathways

### Pathway 1: Automatic During Fathom Sync (Primary)

**Function:** `fathom-sync` → `autoFetchTranscriptAndAnalyze()` (lines 814-982)

**When it runs:**
1. During every meeting sync (cron job, manual sync, webhook)
2. Calls `autoFetchTranscriptAndAnalyze()` at line 1246

**Conditions for action item extraction:**
```typescript
// Must pass ALL these checks:
1. transcript_fetch_attempts < 3          // Max 3 attempts
2. !meeting.transcript_text               // No existing transcript
3. Minutes since last attempt >= 5        // 5-minute cooldown
```

**Process:**
1. Fetch transcript from Fathom API
2. Run Claude AI analysis on transcript
3. Extract action items, sentiment, talk time
4. Deduplicate against Fathom's action items
5. Store in `meeting_action_items` table

**Why it might not work:**
- ❌ Transcript already exists → skips extraction
- ❌ Max 3 attempts reached → stops trying
- ❌ Less than 5 minutes since last attempt → waits
- ❌ Fathom transcript not ready (404) → retry later

### Pathway 2: Manual Via UI Button (Backup)

**Function:** `extract-action-items` (separate edge function)

**When it runs:**
- User clicks "Extract Action Items" button in Meeting Detail page
- Called at line 362 in `src/pages/MeetingDetail.tsx`

**Process:**
1. Check if transcript exists in database
2. If not, calls `fetch-transcript` function first
3. Run Claude AI analysis on stored transcript
4. Extract action items
5. Store in `meeting_action_items` table

**Why this exists:**
- Backup for meetings where auto-extraction failed
- User can retry if initial extraction didn't work
- Works with stored transcript (doesn't fetch from Fathom again)

## Current Issue Investigation

**Problem:** Action items not appearing in database for recent meetings

**Possible causes:**

1. **Transcript already exists when sync runs**
   - If transcript was fetched in a previous sync, `autoFetchTranscriptAndAnalyze()` exits early
   - Solution: Check `transcript_fetch_attempts` and `last_transcript_fetch_at` in database

2. **Transcript not available yet from Fathom**
   - Fathom takes time to process recordings
   - Returns 404 until ready
   - Adaptive retries with increasing cooldown (5 min → 15 min → 60 min → 180+ min)
   - Solution: Check function logs for "Transcript not yet available"

3. **Heavy retry zone**
   - After 12+ failed attempts, retries slow to every 3 hours (then 12 hours past 24 attempts)
   - Solution: Check if `transcript_fetch_attempts >= 12` and review Fathom recording status

4. **AI analysis is failing**
   - Claude API errors
   - Token limits exceeded
   - Solution: Check function logs for "Error in auto-fetch and analyze"

5. **Action items extracted but not stored**
   - Database insert errors
   - Duplicate detection preventing storage
   - Solution: Check logs for "Storing X AI-generated action items"

## Diagnostic Steps

### Step 1: Check Meeting Status
Run `check_transcript_status.sql`:
```sql
SELECT
  m.id,
  m.title,
  m.transcript_text IS NOT NULL as has_transcript,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  COUNT(ai.id) as action_item_count
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '48 hours'
GROUP BY m.id, m.title, m.transcript_text, m.transcript_fetch_attempts, m.last_transcript_fetch_at
ORDER BY m.meeting_start DESC;
```

**What to look for:**
- `has_transcript = true` but `action_item_count = 0` → Extraction didn't run
- `transcript_fetch_attempts >= 12` → Heavy retry zone, may need manual reset
- `minutes_since_last_fetch < cooldown` → Still in cooldown (check adaptive timing)

### Step 2: Check Function Logs
Go to: Supabase Dashboard → Functions → fathom-sync → Logs

**Look for these messages:**
- `📄 Auto-fetching transcript for <id>` → Attempting fetch
- `⏭️  Transcript already exists` → Skipping because exists
- `⏭️  Skipping transcript fetch ... cooling down` → Waiting for adaptive cooldown to expire
- `ℹ️  Transcript not yet available` → Fathom still processing
- `🤖 Running Claude AI analysis` → Analysis started
- `💾 Storing X AI-generated action items` → Action items being saved
- `✅ Stored X AI action items` → Success!

### Step 3: Manual Retry
If auto-extraction failed:
1. Go to Meeting Detail page
2. Click "Extract Action Items" button
3. This will retry with stored transcript

## Recommended Fix

If meetings have transcripts but no action items, we need to:

1. **Reset retry counter** for meetings that failed:
   ```sql
   UPDATE meetings
   SET transcript_fetch_attempts = 0,
       last_transcript_fetch_at = NULL
   WHERE transcript_text IS NOT NULL
     AND id IN (
       SELECT m.id FROM meetings m
       LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
       WHERE m.created_at > NOW() - INTERVAL '48 hours'
       GROUP BY m.id
       HAVING COUNT(ai.id) = 0
     );
   ```

2. **Or run manual extraction** via edge function for each meeting

3. **Or modify the logic** to run extraction even if transcript exists (one-time catch-up)

## Code Location Reference

**Fathom Sync:**
- File: `supabase/functions/fathom-sync/index.ts`
- Main function: `autoFetchTranscriptAndAnalyze()` (lines 814-982)
- Called from: `syncSingleCall()` at line 1246

**Manual Extraction:**
- File: `supabase/functions/extract-action-items/index.ts`
- UI trigger: `src/pages/MeetingDetail.tsx` line 362

**Action Item Storage:**
- Table: `meeting_action_items`
- Insert: Lines 952-970 in `fathom-sync/index.ts`
