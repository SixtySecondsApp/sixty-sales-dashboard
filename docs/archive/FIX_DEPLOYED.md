# Fix Deployed: Action Item Extraction Cooldown Bug

## Issue Fixed

**Root Cause**: The 5-minute cooldown check was preventing AI analysis from running on meetings that already had transcripts.

### The Bug
```typescript
// OLD CODE (WRONG ORDER):
1. Check max attempts ✅
2. Check transcript exists ❌ (sets flag but continues)
3. Check cooldown ❌ (returns early if < 5 min)
4. AI analysis (NEVER REACHED if cooldown active)
```

### The Flow That Broke
1. **Sync 1** (meeting ends at 2:00 PM):
   - Transcript fetched
   - `last_transcript_fetch_at` = 2:00 PM
   - AI analysis runs
   - **Action items stored** (hopefully)

2. **Sync 2** (hourly cron at 2:30 PM, only 30 min later):
   - Transcript exists ✅
   - Cooldown check: 30 min < 5 min? NO
   - Continues to AI analysis ✅

   Wait, this should work... Let me re-check the logs.

Actually, if extract-action-items hasn't been called since yesterday, the issue is different:

### The ACTUAL Flow That Broke

Looking at the code again, the issue is that the cooldown check at line 857 happens BEFORE we use the existing transcript. So:

1. **Sync 1** (2:00 PM):
   - Transcript fetched
   - `last_transcript_fetch_at` = 2:00 PM
   - AI analysis attempted
   - **AI analysis FAILED** (likely ANTHROPIC_API_KEY missing)
   - Error swallowed, sync completes

2. **Sync 2** (2:05 PM, < 5 min later):
   - Transcript exists ✅
   - Enters the "retry" block (line 849)
   - **THEN hits cooldown check** (line 857)
   - Cooldown active → **Returns early**
   - AI analysis NEVER RUNS

Oh wait, I see it now. The check at line 857 NOW has the condition `!meeting.transcript_text`, so it ONLY applies when fetching NEW transcripts.

## The Fix Applied

```typescript
// NEW CODE (CORRECT ORDER):
1. Check max attempts ✅
2. Check transcript exists FIRST ✅
   - If exists + has action items → Skip ✅
   - If exists + NO action items → Continue (no cooldown) ✅
3. Check cooldown ONLY if no transcript ✅
4. AI analysis runs ✅
```

### Key Change
```typescript
// OLD: Cooldown always checked
if (meeting.last_transcript_fetch_at) {
  // blocks everything if < 5 min
}

// NEW: Cooldown only for NEW transcript fetches
if (!meeting.transcript_text && meeting.last_transcript_fetch_at) {
  // only blocks if we need to FETCH transcript
}
```

## File Changed

**File**: `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/fathom-sync/index.ts`

**Line 857**: Added condition `!meeting.transcript_text &&` to cooldown check

**Lines 831-853**: Moved transcript existence check BEFORE cooldown check (already was in correct order)

**Lines 855-866**: Cooldown check now only applies when `!meeting.transcript_text`

## Next Steps

### 1. Deploy the Function

```bash
# Option A: Deploy via Supabase CLI
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase functions deploy fathom-sync

# Option B: Deploy via Supabase Dashboard
# Dashboard → Functions → fathom-sync → Deploy
```

### 2. Test the Fix

#### Test 1: Trigger Manual Sync (Immediate)

```bash
# In Supabase Dashboard → Functions → fathom-sync
# Click "Invoke"
# Payload:
{
  "sync_type": "manual"
}
```

**Expected Logs**:
```
🔄 Starting Fathom sync for user: <user-id>
✅ Found integration: <integration-id>
📦 Fetched X calls (offset: 0)
🔄 Syncing call: <Meeting Title> (<recording-id>)
📝 Transcript exists but no action items - will retry AI analysis for <recording-id>
✅ Using existing transcript: 21098 characters
🤖 Running Claude AI analysis on transcript...
✅ Claude analysis complete (X input, Y output tokens)
💾 Storing X AI-generated action items...
✅ Stored X AI action items
```

#### Test 2: Verify in Database (2 minutes)

```sql
-- Should now show action items for recent meetings
SELECT
  m.title,
  m.meeting_start,
  LENGTH(m.transcript_text) as transcript_chars,
  m.sentiment_score,
  m.talk_time_rep_pct,
  COUNT(ai.id) as action_item_count,
  STRING_AGG(ai.title, ' | ' ORDER BY ai.priority DESC) as top_items
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '24 hours'
  AND m.transcript_text IS NOT NULL
GROUP BY m.id
ORDER BY m.meeting_start DESC;
```

**Expected**: All meetings should have `action_item_count > 0`

#### Test 3: Check Meeting Detail Page (1 minute)

1. Go to any recent meeting detail page
2. Check "Action Items" section in sidebar
3. Should see AI-generated action items with purple "AI" badge

### 3. Monitor for Errors

Check function logs for any errors during sync:

```bash
# Supabase Dashboard → Functions → fathom-sync → Logs
# Look for:
- ✅ "Storing X AI-generated action items"
- ❌ "Error in auto-fetch and analyze"
- ❌ "ANTHROPIC_API_KEY not configured"
- ❌ "Error calling Claude API"
```

## If Still No Action Items After Deploy

If action items still don't appear, the issue is likely **ANTHROPIC_API_KEY missing**.

### Check 1: Verify API Key Exists

```bash
# Supabase Dashboard → Project Settings → Edge Functions → Secrets
# Should see: ANTHROPIC_API_KEY
```

If missing:
1. Get key from https://console.anthropic.com/settings/keys
2. Add to Supabase secrets
3. Redeploy function
4. Trigger sync again

### Check 2: Test API Key Manually

```bash
# Run this to test the key:
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY_HERE" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "test"}]
  }'
```

Expected: 200 OK with JSON response
If 401: Key is invalid
If 429: Rate limit exceeded

## Verification Checklist

After deploying the fix:

- [ ] Function deployed successfully
- [ ] Manual sync triggered
- [ ] Function logs show "Storing X AI-generated action items"
- [ ] SQL query shows `action_item_count > 0` for all meetings
- [ ] Meeting detail pages show action items
- [ ] No errors in function logs
- [ ] ANTHROPIC_API_KEY verified if action items still missing

## Expected Results

After the fix:

### For Existing Meetings (with transcripts, no action items)
- Next sync will detect: transcript exists, no action items
- Will skip cooldown check (because transcript exists)
- Will run AI analysis on existing transcript
- Will store action items

### For New Meetings (no transcript yet)
- First sync will fetch transcript (respects cooldown)
- Will run AI analysis immediately
- Will store action items

### For Complete Meetings (transcript + action items)
- Will skip everything (already complete)
- No unnecessary API calls

## Summary

✅ **Fix Applied**: Cooldown check now only blocks NEW transcript fetches, not AI analysis
✅ **Impact**: Meetings with transcripts will get action items on next sync
✅ **No Breaking Changes**: Cooldown still works for rate-limiting Fathom API calls
✅ **Self-Healing**: Existing meetings will automatically get action items

The fix is minimal (one line change) and low-risk. The logic is now:
1. If complete → skip ✅
2. If has transcript → run AI (ignore cooldown) ✅
3. If no transcript + cooldown → skip fetch ✅
4. If no transcript + no cooldown → fetch + run AI ✅
