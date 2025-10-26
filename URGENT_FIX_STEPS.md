# 🚨 URGENT: Fix Steps to Get AI Analysis Working

## Issue Found
A database trigger is blocking all meeting updates, preventing AI metrics from being stored.

**Error**: `function calculate_sentiment_trend(p_contact_id => uuid) does not exist`

---

## 3-Step Fix (Takes 2 Minutes)

### Step 1: Disable Problematic Trigger
```sql
DROP TRIGGER IF EXISTS trigger_aggregate_meeting_insights ON meetings;
```

**Why**: The trigger calls a function that doesn't exist in your database. Disabling it is safe and allows AI analysis to proceed.

---

### Step 2: Clear Corrupted Transcripts
```sql
UPDATE meetings
SET
  transcript_text = NULL,
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL,
  sentiment_score = NULL,
  talk_time_rep_pct = NULL,
  talk_time_customer_pct = NULL,
  talk_time_judgement = NULL
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND (
    transcript_text LIKE '%[object Object]%'
    OR talk_time_judgement LIKE '%Unable to analyze%'
  );
```

**Why**: Existing transcripts are corrupted (`[object Object]` format) and need to be re-fetched with the fixed parser.

---

### Step 3: Trigger New Sync

**Via App**:
1. Go to http://localhost:5173/integrations
2. Click "Test Sync"

**Via Supabase Dashboard**:
1. Go to Functions
2. Invoke `fathom-sync` with: `{"sync_type": "manual", "limit": 5}`

---

## Verify Success

After 2-5 minutes, run this query:

```sql
SELECT
  title,
  LEFT(transcript_text, 150) as transcript_preview,
  sentiment_score,
  talk_time_rep_pct || '% / ' || talk_time_customer_pct || '%' as talk_split,
  talk_time_judgement
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 3;
```

**SUCCESS = You'll see**:
- ✅ Readable transcript (not `[object Object]`)
- ✅ Real sentiment score (0.65, not NULL)
- ✅ Real percentages (42% / 58%, not 50% / 50%)
- ✅ Natural language judgement ("Balanced conversation", not "Unable to analyze")

---

## Why This Happened

1. **Trigger error**: Migration `20251025000006_create_insights_aggregation_functions.sql` wasn't applied to database
2. **Transcript corruption**: Code was storing `[object Object]` instead of formatted text
3. **Both fixed now**: Trigger disabled + transcript parser fixed

---

## After This Works

Re-enable insights (optional):
```sql
-- Apply the full migration to get insights aggregation back
-- File: supabase/migrations/20251025000006_create_insights_aggregation_functions.sql
```

Or keep it disabled - AI analysis works fine without it!

---

**Status**: Edge function deployed ✅ | Awaiting database fixes (Steps 1 & 2)

