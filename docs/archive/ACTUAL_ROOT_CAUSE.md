# ACTUAL ROOT CAUSE: 5-Minute Cooldown Logic

> **Update – 2025-11-12:** The transcript retry logic now uses adaptive cooldowns and no longer stops after three attempts. The analysis below documents the original issue for historical context.

## The Real Issue

**The AI extraction IS in the code, but it's being SKIPPED by the cooldown logic!**

### What's Happening

#### Line 854-864 in `fathom-sync/index.ts`:
```typescript
// Check last attempt time - wait at least 5 minutes between attempts
if (meeting.last_transcript_fetch_at) {
  const lastAttempt = new Date(meeting.last_transcript_fetch_at)
  const now = new Date()
  const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

  if (minutesSinceLastAttempt < 5) {
    console.log(`⏭️  Skipping transcript fetch for ${recordingId} - last attempt was ${Math.round(minutesSinceLastAttempt)} min ago (waiting 5 min)`)
    return  // ❌ EXITS EARLY - AI ANALYSIS NEVER RUNS!
  }
}
```

### The Problem Flow

1. **First sync** (meeting just ended):
   - Meeting created
   - `last_transcript_fetch_at` = NULL
   - Transcript fetched ✅
   - **Sets `last_transcript_fetch_at` = NOW** (line 877)
   - AI analysis runs ✅ (probably succeeds)
   - Action items stored ✅

2. **Second sync** (< 5 minutes later - e.g., hourly cron at 2:00 PM):
   - Meeting exists
   - `last_transcript_fetch_at` = 1:58 PM (2 minutes ago)
   - **Line 860-862: SKIPS because only 2 minutes have passed**
   - Returns early ❌
   - **AI analysis NEVER RUNS**

3. **Third sync** (> 5 minutes later - e.g., 2:05 PM):
   - Meeting exists
   - Transcript already exists
   - **Line 833-851: Checks for action items**
   - If action items exist → Skip (correct)
   - If no action items → Continue to AI analysis (correct)
   - **But if AI failed in step 1**, this is the retry logic

### Why This Breaks

The **cooldown check happens BEFORE the transcript existence check**!

Current order:
1. Check max attempts (line 824-829) ✅
2. **Check cooldown (line 854-864)** ❌ TOO EARLY!
3. Check transcript existence (line 833-852) - NEVER REACHED

Should be:
1. Check max attempts
2. **Check transcript existence FIRST**
3. Only check cooldown if we need to FETCH transcript

### The Fix

Move the cooldown check to ONLY apply when fetching NEW transcripts:

```typescript
async function autoFetchTranscriptAndAnalyze(
  supabase: any,
  userId: string,
  integration: any,
  meeting: any,
  call: any
): Promise<void> {
  try {
    const recordingId = call.recording_id

    // Check retry attempts - don't try more than 3 times
    const fetchAttempts = meeting.transcript_fetch_attempts || 0
    if (fetchAttempts >= 3) {
      console.log(`⏭️  Skipping transcript fetch for ${recordingId} - max attempts (3) reached`)
      return
    }

    // ✅ MOVED: Check if we already have transcript AND action items FIRST
    if (meeting.transcript_text) {
      // Check if action items exist for this meeting
      const { data: existingActionItems, error: aiCheckError } = await supabase
        .from('meeting_action_items')
        .select('id')
        .eq('meeting_id', meeting.id)
        .limit(1)

      if (aiCheckError) {
        console.error(`⚠️  Error checking action items: ${aiCheckError.message}`)
      }

      if (existingActionItems && existingActionItems.length > 0) {
        console.log(`⏭️  Transcript and action items already exist for ${recordingId}`)
        return  // Skip - already complete
      } else {
        console.log(`📝 Transcript exists but no action items - will retry AI analysis for ${recordingId}`)
        // Continue to AI analysis using existing transcript
        // NO COOLDOWN CHECK - we have transcript, just need to run AI
      }
    }

    // ✅ MOVED: Only check cooldown when we need to FETCH a new transcript
    if (!meeting.transcript_text && meeting.last_transcript_fetch_at) {
      const lastAttempt = new Date(meeting.last_transcript_fetch_at)
      const now = new Date()
      const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

      if (minutesSinceLastAttempt < 5) {
        console.log(`⏭️  Skipping transcript fetch for ${recordingId} - last attempt was ${Math.round(minutesSinceLastAttempt)} min ago (waiting 5 min)`)
        return
      }
    }

    // Determine if we need to fetch transcript or use existing
    let transcript: string | null = meeting.transcript_text

    if (!transcript) {
      console.log(`📄 Auto-fetching transcript for ${recordingId} (attempt ${fetchAttempts + 1}/3)...`)

      // Update fetch tracking
      await supabase
        .from('meetings')
        .update({
          transcript_fetch_attempts: fetchAttempts + 1,
          last_transcript_fetch_at: new Date().toISOString(),
        })
        .eq('id', meeting.id)

      // Fetch transcript from Fathom
      transcript = await fetchTranscriptFromFathom(integration.access_token, recordingId)

      if (!transcript) {
        console.log(`ℹ️  Transcript not yet available for ${recordingId} - will retry next sync`)
        return
      }

      console.log(`✅ Transcript fetched: ${transcript.length} characters`)

      // Fetch enhanced summary
      let summaryData: any = null
      try {
        summaryData = await fetchSummaryFromFathom(integration.access_token, recordingId)
        if (summaryData) {
          console.log(`✅ Enhanced summary fetched`)
        }
      } catch (error) {
        console.log(`⚠️  Summary fetch failed (non-fatal): ${error.message}`)
      }

      // Store transcript immediately
      await supabase
        .from('meetings')
        .update({
          transcript_text: transcript,
          summary: summaryData?.summary || meeting.summary,
        })
        .eq('id', meeting.id)
    } else {
      console.log(`✅ Using existing transcript: ${transcript.length} characters`)
    }

    // ✅ AI ANALYSIS RUNS HERE - always runs if we have transcript
    // (rest of function unchanged)
```

### Why This Fixes It

**Before (broken)**:
```
Sync 1: Fetch transcript → Set cooldown timer → AI analysis runs
Sync 2 (< 5 min): See cooldown → SKIP EVERYTHING → No AI analysis
Sync 3 (> 5 min): Cooldown expired → Check transcript exists → AI runs (retry)
```

**After (fixed)**:
```
Sync 1: Fetch transcript → AI analysis runs
Sync 2 (any time): Transcript exists → Skip cooldown check → AI analysis runs (retry if needed)
Sync 3+: Action items exist → Skip everything ✅
```

## Implementation

### File to Edit
`/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/fathom-sync/index.ts`

### Lines to Change
Move lines 854-864 to AFTER lines 833-852, and add condition `!meeting.transcript_text`

### Changes Required

**BEFORE (lines 824-864)**:
```typescript
// Check retry attempts - don't try more than 3 times
const fetchAttempts = meeting.transcript_fetch_attempts || 0
if (fetchAttempts >= 3) {
  console.log(`⏭️  Skipping transcript fetch for ${recordingId} - max attempts (3) reached`)
  return
}

// Check if we already have transcript AND action items
// If transcript exists but no action items, we should retry AI analysis
if (meeting.transcript_text) {
  // Check if action items exist for this meeting
  const { data: existingActionItems, error: aiCheckError } = await supabase
    .from('meeting_action_items')
    .select('id')
    .eq('meeting_id', meeting.id)
    .limit(1)

  if (aiCheckError) {
    console.error(`⚠️  Error checking action items: ${aiCheckError.message}`)
  }

  if (existingActionItems && existingActionItems.length > 0) {
    console.log(`⏭️  Transcript and action items already exist for ${recordingId}`)
    return
  } else {
    console.log(`📝 Transcript exists but no action items - will retry AI analysis for ${recordingId}`)
    // Continue to AI analysis using existing transcript
  }
}

// Check last attempt time - wait at least 5 minutes between attempts
if (meeting.last_transcript_fetch_at) {
  const lastAttempt = new Date(meeting.last_transcript_fetch_at)
  const now = new Date()
  const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

  if (minutesSinceLastAttempt < 5) {
    console.log(`⏭️  Skipping transcript fetch for ${recordingId} - last attempt was ${Math.round(minutesSinceLastAttempt)} min ago (waiting 5 min)`)
    return
  }
}
```

**AFTER (reordered)**:
```typescript
// Check retry attempts - don't try more than 3 times
const fetchAttempts = meeting.transcript_fetch_attempts || 0
if (fetchAttempts >= 3) {
  console.log(`⏭️  Skipping transcript fetch for ${recordingId} - max attempts (3) reached`)
  return
}

// ✅ FIRST: Check if we already have transcript AND action items
if (meeting.transcript_text) {
  // Check if action items exist for this meeting
  const { data: existingActionItems, error: aiCheckError } = await supabase
    .from('meeting_action_items')
    .select('id')
    .eq('meeting_id', meeting.id)
    .limit(1)

  if (aiCheckError) {
    console.error(`⚠️  Error checking action items: ${aiCheckError.message}`)
  }

  if (existingActionItems && existingActionItems.length > 0) {
    console.log(`⏭️  Transcript and action items already exist for ${recordingId}`)
    return
  } else {
    console.log(`📝 Transcript exists but no action items - will retry AI analysis for ${recordingId}`)
    // Continue to AI analysis using existing transcript
    // Cooldown does NOT apply here - we're just running AI on existing transcript
  }
}

// ✅ SECOND: Only check cooldown when we need to FETCH a new transcript
if (!meeting.transcript_text && meeting.last_transcript_fetch_at) {
  const lastAttempt = new Date(meeting.last_transcript_fetch_at)
  const now = new Date()
  const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

  if (minutesSinceLastAttempt < 5) {
    console.log(`⏭️  Skipping transcript fetch for ${recordingId} - last attempt was ${Math.round(minutesSinceLastAttempt)} min ago (waiting 5 min)`)
    return
  }
}
```

The key change: Add `!meeting.transcript_text &&` to line 855.

## Testing the Fix

### Test 1: Verify Current Behavior

Run this SQL to see meetings stuck in cooldown:
```sql
SELECT
  m.id,
  m.title,
  m.transcript_text IS NOT NULL as has_transcript,
  EXTRACT(EPOCH FROM (NOW() - m.last_transcript_fetch_at)) / 60 as minutes_since_fetch,
  COUNT(ai.id) as action_items,
  CASE
    WHEN m.transcript_text IS NOT NULL
      AND EXTRACT(EPOCH FROM (NOW() - m.last_transcript_fetch_at)) / 60 < 5
      AND NOT EXISTS (SELECT 1 FROM meeting_action_items WHERE meeting_id = m.id)
    THEN '❌ STUCK IN COOLDOWN'
    ELSE '✅ OK'
  END as status
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '24 hours'
GROUP BY m.id
ORDER BY m.meeting_start DESC;
```

### Test 2: After Fix

1. Deploy the updated `fathom-sync` function
2. Trigger manual sync: `{"sync_type": "manual"}`
3. Check logs for: `📝 Transcript exists but no action items - will retry AI analysis`
4. Verify action items are created

### Test 3: Verify Cooldown Still Works

Create a NEW meeting (no transcript yet):
- First sync: Should fetch transcript
- Second sync (< 5 min): Should skip fetch due to cooldown ✅
- Third sync (> 5 min): Should fetch transcript if still not available ✅

## Summary

- ✅ **Integration exists** - code is correct
- ❌ **Logic bug** - cooldown check in wrong place
- 🔧 **Fix** - Move cooldown check after transcript existence check
- ⏱️ **Impact** - Meetings with transcripts will get action items on next sync

This explains why `extract-action-items` hasn't been called - the cooldown logic prevents `autoFetchTranscriptAndAnalyze` from running the AI analysis!
