-- Reprocess All Meetings with Claude Haiku 4.5 AI
-- Purpose: Batch analyze all meeting transcripts to extract action items
-- Date: 2025-01-06
--
-- This script calls the reprocess-meetings-ai edge function to:
-- 1. Fetch all meetings with transcripts
-- 2. Analyze each with Claude Haiku 4.5
-- 3. Extract action items (no automatic task creation)
-- 4. Store action items for manual task selection

-- ========================================
-- STEP 1: Check current state
-- ========================================

-- See which meetings have transcripts
SELECT
    'Meetings with Transcripts' as step,
    COUNT(*) as meetings_with_transcripts,
    COUNT(*) FILTER (WHERE sentiment_score IS NOT NULL) as already_analyzed,
    COUNT(*) FILTER (WHERE sentiment_score IS NULL) as need_analysis
FROM meetings
WHERE transcript_text IS NOT NULL;

-- See current action items count
SELECT
    'Current Action Items' as step,
    COUNT(*) as total_action_items,
    COUNT(*) FILTER (WHERE ai_generated = true) as ai_generated,
    COUNT(*) FILTER (WHERE synced_to_task = true) as synced_to_tasks,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as linked_to_tasks
FROM meeting_action_items;

-- ========================================
-- STEP 2: Call the reprocess edge function
-- ========================================

/*
OPTION 1: Reprocess ALL meetings (safest - skips meetings with existing action items)
------------------------------------------

Use this curl command in your terminal:

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "limit": 100,
    "force": false
  }'

Replace YOUR_ANON_KEY with your Supabase anon key from .env file.


OPTION 2: Force reprocess ALL meetings (deletes existing action items first)
------------------------------------------

WARNING: This will delete all existing action items and recreate them!

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "force": true
  }'


OPTION 3: Process specific meetings only
------------------------------------------

Get meeting IDs first, then pass them to the function:
*/

-- Get meeting IDs that need processing
SELECT
    id,
    title,
    meeting_start,
    LENGTH(transcript_text) as transcript_length
FROM meetings
WHERE transcript_text IS NOT NULL
  AND meeting_start >= '2025-10-29' -- Last ~10 days
ORDER BY meeting_start DESC;

/*
Then use this curl command with specific meeting IDs:

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "meeting_ids": ["meeting-id-1", "meeting-id-2"],
    "force": false
  }'


OPTION 4: Process for specific user only
------------------------------------------

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "user-uuid-here",
    "force": false
  }'
*/

-- ========================================
-- STEP 3: Verify action items were created
-- ========================================

-- Run this after calling the edge function:

SELECT
    'Verification After Reprocessing' as step,
    m.title as meeting_title,
    m.meeting_start,
    COUNT(mai.id) as action_items_count,
    COUNT(*) FILTER (WHERE mai.ai_generated = true) as ai_generated,
    COUNT(*) FILTER (WHERE mai.synced_to_task = false) as not_synced,
    COUNT(*) FILTER (WHERE mai.task_id IS NULL) as no_task_link,
    STRING_AGG(mai.title, '; ') as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.transcript_text IS NOT NULL
  AND m.meeting_start >= '2025-10-29'
GROUP BY m.id, m.title, m.meeting_start
ORDER BY m.meeting_start DESC;

-- Check that NO action items are automatically synced to tasks
SELECT
    'Action Items Sync Status' as check,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE synced_to_task = true) as synced_to_tasks,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as linked_to_tasks,
    COUNT(*) FILTER (WHERE synced_to_task = false AND task_id IS NULL) as ready_for_manual_selection
FROM meeting_action_items
WHERE ai_generated = true;

-- ========================================
-- STEP 4: Check AI metrics were updated
-- ========================================

SELECT
    'AI Metrics Status' as check,
    COUNT(*) as meetings_with_transcripts,
    COUNT(*) FILTER (WHERE sentiment_score IS NOT NULL) as has_sentiment,
    COUNT(*) FILTER (WHERE talk_time_rep_pct IS NOT NULL) as has_talk_time,
    AVG(sentiment_score) as avg_sentiment,
    AVG(talk_time_rep_pct) as avg_rep_talk_pct
FROM meetings
WHERE transcript_text IS NOT NULL;

-- ========================================
-- NOTES
-- ========================================

/*
What this reprocessing does:
✅ Analyzes all meeting transcripts with Claude Haiku 4.5
✅ Extracts action items, talk time, and sentiment
✅ Stores action items WITHOUT automatic task creation
✅ Sets synced_to_task = false and task_id = null
✅ Allows manual task selection via UI

What happens after reprocessing:
1. Go to meeting detail pages
2. View action items in the right sidebar
3. Click "Add to Tasks" button to manually create tasks
4. Tasks appear in your task list only when you add them

Configuration:
- Model: Claude Haiku 4.5 (claude-haiku-4-5-20251001)
- Set via CLAUDE_MODEL environment variable in Supabase
- Requires ANTHROPIC_API_KEY to be configured

Performance:
- Each meeting takes ~2-5 seconds to analyze
- 21 meetings = ~1-2 minutes total
- Non-blocking: edge function returns progress
- Logs available in Supabase Functions logs

Error Handling:
- Skips meetings without transcripts
- Continues on individual meeting errors
- Returns summary with error details
- Check Supabase Functions logs for details
*/

-- ========================================
-- TROUBLESHOOTING
-- ========================================

/*
If reprocessing doesn't work:

1. Check edge function is deployed:
   - Go to Supabase Dashboard → Edge Functions
   - Look for "reprocess-meetings-ai"
   - Deploy if missing

2. Check environment variables:
   - ANTHROPIC_API_KEY must be set
   - CLAUDE_MODEL = claude-haiku-4-5-20251001 (or default)

3. Check function logs:
   - Supabase Dashboard → Edge Functions → Logs
   - Look for errors during processing

4. Verify transcript exists:
   - Run STEP 1 query above
   - Ensure meetings have transcript_text

5. Check permissions:
   - Service role key bypasses RLS
   - Should work for all users

6. Test with single meeting first:
   - Use Option 3 with just one meeting_id
   - Check logs for that specific meeting
*/
