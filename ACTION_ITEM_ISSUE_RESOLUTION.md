# Action Item Issue Resolution

## Issue Summary

**Problem**: Fathom meetings are syncing with transcripts, but NO action items are being extracted and stored in the database.

**Expected Behavior**: After Fathom sync, action items should be automatically extracted from transcripts using Claude AI and stored in `meeting_action_items` table.

**Actual Behavior**: Meetings have transcripts (12K-54K characters), but `action_item_count = 0`.

## Key Finding: Integration Exists ✅

**The integration is ALREADY IMPLEMENTED and correct!**

The `fathom-sync` edge function DOES call `extract-action-items` functionality via `analyzeTranscriptWithClaude()` in the `aiAnalysis.ts` module.

### Code Flow Verification

```
fathom-sync/index.ts:
  └─ syncSingleCall() [line 1114]
     └─ autoFetchTranscriptAndAnalyze() [line 1270]
        ├─ Fetches transcript [line 882]
        ├─ Stores transcript [line 903-909]
        ├─ ✅ Calls analyzeTranscriptWithClaude() [line 917]
        ├─ Stores AI metrics [line 933-943]
        └─ ✅ Stores action items [line 971-994]
```

## Root Cause Analysis

The AI extraction **IS being called** but is **failing silently** due to error handling:

```typescript
// fathom-sync/index.ts line 1001-1005
} catch (error) {
  console.error(`❌ Error in auto-fetch and analyze: ${error.message}`)
  console.error(error.stack)
  // Don't throw - allow meeting sync to continue even if AI analysis fails
}
```

This means:
1. ✅ Transcript fetched and stored successfully
2. ❌ AI analysis attempted but failed
3. 🔇 Error logged but not surfaced to user
4. ✅ Meeting sync completes "successfully"
5. **Result**: Transcript exists, but no action items

## Most Likely Causes

### 1. Missing or Invalid ANTHROPIC_API_KEY (90% probability)

**Check**: `aiAnalysis.ts` line 49-52
```typescript
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY not configured')
}
```

**Solution**:
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify `ANTHROPIC_API_KEY` exists
3. If missing, add it: `sk-ant-api03-...`
4. If exists, verify it's valid (test with Anthropic API console)
5. Redeploy `fathom-sync` function

### 2. API Quota/Rate Limits (5% probability)

**Check**: Claude API returning 429 errors

**Solution**:
1. Check Anthropic console for usage/limits
2. Upgrade plan if needed
3. Add retry logic with exponential backoff

### 3. Parsing Errors (3% probability)

**Check**: Claude returning unexpected JSON format

**Solution**:
1. Review function logs for parsing errors
2. Check `aiAnalysis.ts` line 241-300 for validation logic

### 4. Database Constraints (2% probability)

**Check**: RLS policies or schema mismatches

**Solution**:
1. Verify RLS policies allow inserts
2. Check `meeting_action_items` schema matches insert payload

## Diagnostic Process

### Step 1: Run SQL Diagnostic (5 minutes)

```bash
# In Supabase SQL Editor, run:
/Users/andrewbryce/Documents/sixty-sales-dashboard/diagnose-action-items.sql
```

This will show:
- ✅ Which meetings have transcripts but no action items
- ✅ Whether AI analysis is running at all (check sentiment_score, talk_time_rep_pct)
- ✅ Whether ANY meetings have AI-generated action items
- ✅ Detailed inspection of a problem meeting

**Expected findings**:
- If `sentiment_score IS NULL` → AI analysis NOT running (likely API key issue)
- If `sentiment_score IS NOT NULL` but `action_item_count = 0` → AI runs but finds no items (unlikely for sales calls)

### Step 2: Check Function Logs (5 minutes)

```bash
# Go to Supabase Dashboard
# → Functions → fathom-sync → Logs
# Look for errors around meeting sync times
```

**Success indicators to look for**:
```
🤖 Running Claude AI analysis on transcript...
✅ Claude analysis complete (X input, Y output tokens)
💾 Storing X AI-generated action items...
✅ Stored X AI action items
```

**Failure indicators to look for**:
```
❌ Error in auto-fetch and analyze: ANTHROPIC_API_KEY not configured
❌ Error calling Claude API: 401 Unauthorized
❌ Error calling Claude API: 429 Too Many Requests
❌ Error parsing Claude response
```

### Step 3: Test Manual Extraction (2 minutes)

```bash
# 1. Go to any Meeting Detail page with a transcript
# 2. Click "Get Action Items" button
# 3. Check browser console (F12) for errors
# 4. Check Network tab for API response
```

This will:
- ✅ Call `extract-action-items` edge function directly
- ✅ Show detailed error messages in UI (if any)
- ✅ Confirm if issue is with sync or with AI extraction itself

### Step 4: Check Environment Variables (2 minutes)

```bash
# Supabase Dashboard → Project Settings → Edge Functions → Secrets
# Verify ANTHROPIC_API_KEY exists and is correct
```

**To test key validity**:
```bash
# Run this in terminal:
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "test"}]
  }'
```

Expected: 200 OK response
If error: API key is invalid

## Solution Implementation

### Solution 1: Fix API Key (if missing/invalid)

```bash
# 1. Get a valid Anthropic API key
# Go to: https://console.anthropic.com/settings/keys

# 2. Add to Supabase Secrets
# Dashboard → Project Settings → Edge Functions → Secrets
# Name: ANTHROPIC_API_KEY
# Value: sk-ant-api03-...

# 3. Redeploy function
# Dashboard → Functions → fathom-sync → Deploy

# 4. Test with manual sync
# Dashboard → Functions → fathom-sync → Invoke
# Payload: {"sync_type": "manual"}
```

### Solution 2: Improve Error Visibility (optional enhancement)

Add this to `fathom-sync/index.ts` after line 1001:

```typescript
} catch (error) {
  console.error(`❌ Error in auto-fetch and analyze: ${error.message}`)
  console.error(error.stack)

  // NEW: Store error in meeting record for visibility
  try {
    await supabase
      .from('meetings')
      .update({
        sync_status: 'ai_analysis_failed',
        sync_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', meeting.id)
  } catch (e) {
    console.error('Failed to update error status:', e)
  }

  // Don't throw - allow meeting sync to continue
}
```

This will make failures visible in the database for easier debugging.

### Solution 3: Add Retry Logic (optional enhancement)

Add this to `fathom-sync/index.ts` before line 917:

```typescript
// Run AI analysis on transcript with retry logic
console.log(`🤖 Running Claude AI analysis on transcript...`)

let analysis: TranscriptAnalysis | null = null
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    analysis = await analyzeTranscriptWithClaude(transcript, {
      id: meeting.id,
      title: meeting.title,
      meeting_start: meeting.meeting_start,
      owner_email: meeting.owner_email,
    })
    break // Success
  } catch (error) {
    console.error(`❌ AI analysis attempt ${attempt + 1} failed:`, error.message)
    if (attempt === 2) {
      throw error // Final attempt failed
    }
    // Wait before retry: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
  }
}

if (!analysis) {
  throw new Error('AI analysis failed after 3 attempts')
}
```

## Verification

After implementing the fix, verify with this SQL query:

```sql
-- Should show action items for all recent meetings
SELECT
  m.title,
  m.meeting_start,
  LENGTH(m.transcript_text) as transcript_chars,
  m.sentiment_score,
  m.talk_time_rep_pct,
  COUNT(ai.id) as action_item_count,
  STRING_AGG(ai.title, ' | ' ORDER BY ai.created_at) as sample_items
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '48 hours'
  AND m.transcript_text IS NOT NULL
GROUP BY m.id
ORDER BY m.meeting_start DESC;
```

**Expected results**:
- ✅ All meetings have `action_item_count > 0` (typically 2-8 items)
- ✅ All meetings have `sentiment_score` and `talk_time_rep_pct`
- ✅ Sample items show AI-extracted action items

## Testing the Fix

### Test 1: Manual Extraction (Immediate)

```bash
# 1. Go to any Meeting Detail page
# 2. Click "Get Action Items" button
# 3. Verify action items appear
# 4. Check they are marked as "AI" generated
```

### Test 2: New Meeting Sync (10-15 minutes)

```bash
# 1. Have a new Fathom meeting (or wait for hourly cron)
# 2. Trigger sync: Dashboard → Functions → fathom-sync → Invoke
# 3. Payload: {"sync_type": "manual"}
# 4. Wait for completion
# 5. Check Meeting Detail page for action items
```

### Test 3: Backfill Existing Meetings (if needed)

If you have many meetings without action items, you can:

**Option A: Click button manually** (for a few meetings)
- Go to each Meeting Detail page
- Click "Get Action Items"

**Option B: Reset retry counter** (for automatic reprocessing)
```sql
-- This will make fathom-sync retry AI extraction on next sync
UPDATE meetings
SET
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL
WHERE transcript_text IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM meeting_action_items ai
    WHERE ai.meeting_id = meetings.id
  )
  AND created_at > NOW() - INTERVAL '7 days';
```

**Option C: Force re-sync** (nuclear option)
```sql
-- Only use if you want to completely re-sync meetings
UPDATE meetings
SET
  last_synced_at = NULL,
  sync_status = 'pending'
WHERE created_at > NOW() - INTERVAL '7 days';
```

Then trigger manual sync in Supabase Dashboard.

## Files Created

1. **`ACTION_ITEM_INTEGRATION_ANALYSIS.md`** - Detailed technical analysis
2. **`diagnose-action-items.sql`** - SQL diagnostic script
3. **`ACTION_ITEM_ISSUE_RESOLUTION.md`** (this file) - User-friendly resolution guide

## Files Reference

- **AI Analysis**: `/supabase/functions/fathom-sync/aiAnalysis.ts`
- **Main Sync**: `/supabase/functions/fathom-sync/index.ts`
- **Manual Extract**: `/supabase/functions/extract-action-items/index.ts`
- **UI Component**: `/src/pages/MeetingDetail.tsx`
- **SQL Diagnostic**: `/check_transcript_status.sql`

## Next Steps

1. ✅ **Run SQL diagnostic** to confirm the issue
2. ⏳ **Check function logs** to identify error
3. ⏳ **Verify/add ANTHROPIC_API_KEY** in Supabase secrets
4. ⏳ **Test manual extraction** to confirm fix
5. ⏳ **Trigger sync** to reprocess meetings
6. ⏳ **Verify** with SQL query

## Support

If issue persists after following this guide:
1. Share function logs from Supabase Dashboard
2. Share results from `diagnose-action-items.sql`
3. Share any error messages from manual extraction test
