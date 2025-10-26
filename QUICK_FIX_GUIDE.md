# 🚀 Quick Fix Guide - AI Analysis Database Persistence

## The Problem

AI analysis was running successfully in Claude but database showed NULL values for all metrics.

**Root Cause**: Database constraint only allowed `talk_time_judgement IN ('good', 'high', 'low')` but Claude returns natural language like "Well-balanced conversation".

---

## The 2-Minute Fix

### Step 1: Remove Constraint (30 seconds)

Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

Paste and run:
```sql
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_talk_time_judgement_check;
```

**Done!** The constraint is removed.

### Step 2: Test Sync (1 minute)

Option A - Via App:
1. Open http://localhost:5173/integrations
2. Click "Test Sync"

Option B - Via Supabase Dashboard:
1. Go to Functions page
2. Invoke `fathom-sync` with: `{"sync_type": "manual", "limit": 5}`

### Step 3: Verify Success (30 seconds)

Run this query in SQL Editor:
```sql
SELECT
  title,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 5;
```

**Success Indicators**:
- ✅ `sentiment_score` is NOT NULL
- ✅ `talk_time_rep_pct` and `talk_time_customer_pct` are NOT NULL
- ✅ `talk_time_judgement` contains natural language text

---

## If You Still See NULL Values

Check Edge Function logs:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Look for:
- ✅ `rows_updated: 1` = Success!
- ❌ `No rows updated` = Meeting ID mismatch (report to dev)
- ❌ `Error updating` = Database permission issue (report to dev)

---

## Full Documentation

See `AI_ANALYSIS_FIX_COMPLETE.md` for complete technical details.

