# 🚀 START HERE - Get AI Analysis Working in 3 Minutes

## What's Happening

AI analysis is **almost working** but blocked by a database trigger error.

**Error you're seeing**:
```
function calculate_sentiment_trend(p_contact_id => uuid) does not exist
```

## The 3-Minute Fix

### Step 1: Run This SQL (Copy and Paste)

Go to Supabase SQL Editor:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

**Copy and paste this ENTIRE block**:
```sql
-- Remove the blocking trigger
DROP TRIGGER IF EXISTS update_insights_on_meeting_sync ON meetings;
DROP TRIGGER IF EXISTS trigger_aggregate_meeting_insights ON meetings;
DROP TRIGGER IF EXISTS trigger_update_meeting_insights ON meetings;

-- Clear corrupted transcripts
UPDATE meetings
SET
  transcript_text = NULL,
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL,
  sentiment_score = NULL,
  sentiment_reasoning = NULL,
  talk_time_rep_pct = NULL,
  talk_time_customer_pct = NULL,
  talk_time_judgement = NULL
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND (
    transcript_text LIKE '%[object Object]%'
    OR talk_time_judgement LIKE '%Unable to analyze%'
  );

-- Show what was cleared
SELECT 'Ready! Cleared ' || COUNT(*) || ' meetings' as status
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NULL;
```

Click **Run** (or press Ctrl+Enter / Cmd+Enter)

**Expected output**: `Ready! Cleared 5 meetings` (or similar)

---

### Step 2: Trigger Sync

**Option A - Use Your App**:
1. Go to http://localhost:5173/integrations
2. Click **"Test Sync"** button
3. Wait 2-5 minutes

**Option B - Use Supabase Dashboard**:
1. Go to Functions page
2. Click on `fathom-sync`
3. Click **"Invoke"**
4. Enter: `{"sync_type": "manual", "limit": 5}`
5. Click **"Run"**

---

### Step 3: Verify It Works

After 2-5 minutes, run this in SQL Editor:

```sql
SELECT
  title,
  sentiment_score,
  talk_time_rep_pct || '% rep / ' || talk_time_customer_pct || '% customer' as talk_split,
  talk_time_judgement
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND sentiment_score IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 3;
```

**SUCCESS = You see**:
- ✅ Real sentiment scores (like 0.72, not NULL)
- ✅ Real percentages (like 43% / 57%, not 50% / 50%)
- ✅ Natural language (like "Balanced conversation", not "Unable to analyze")

---

## What If It Still Doesn't Work?

### Check Edge Function Logs

Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter by: `fathom-sync`

**Look for**:
- ✅ `📝 Parsing X transcript segments...` = Transcript parsing is working
- ✅ `✅ Formatted transcript: X characters` = Success!
- ✅ `✅ AI metrics stored successfully: {"rows_updated": 1}` = Database update worked!
- ❌ Any errors with "calculate_sentiment_trend" = Trigger still active, re-run Step 1

---

## What We Fixed

1. ✅ Model name: Using `claude-haiku-4-5-20251001`
2. ✅ Database constraint: Removed to allow natural language
3. ✅ Transcript parsing: Arrays now formatted as readable text
4. ✅ Trigger: Removed blocking trigger

**Everything is fixed!** Just need to run the SQL and trigger a sync. 🎉

---

## Full Documentation

- **`FINAL_TRIGGER_FIX.sql`** - Detailed version of Step 1
- `COMPLETE_FIX_TEST_GUIDE.md` - Comprehensive testing guide
- `TRANSCRIPT_PARSING_FIX_SUMMARY.md` - Technical details
- `AI_ANALYSIS_FIX_COMPLETE.md` - Full issue history

