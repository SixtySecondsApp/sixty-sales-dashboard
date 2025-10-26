-- ═══════════════════════════════════════════════════════════════
-- REANALYZE TRANSCRIPTS: Clear AI metrics to trigger re-analysis
-- ═══════════════════════════════════════════════════════════════
-- Use this after updating the AI prompt to re-process meetings
-- with the improved action item extraction
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Check current action item counts
SELECT
  'Before clearing:' as status,
  COUNT(DISTINCT meeting_id) as meetings_with_action_items,
  COUNT(*) as total_action_items
FROM meeting_action_items
WHERE ai_generated = true;

-- Step 2: Clear AI metrics to force re-analysis
-- (Keeps transcripts, just clears the analysis results)
UPDATE meetings
SET
  sentiment_score = NULL,
  sentiment_reasoning = NULL,
  talk_time_rep_pct = NULL,
  talk_time_customer_pct = NULL,
  talk_time_judgement = NULL
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NOT NULL
  AND transcript_text != ''
  AND sentiment_score IS NOT NULL;

-- Step 3: Show which meetings will be re-analyzed
SELECT
  id,
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_length,
  'Ready for re-analysis' as status
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NOT NULL
  AND transcript_text != ''
  AND sentiment_score IS NULL
ORDER BY meeting_start DESC;

-- ═══════════════════════════════════════════════════════════════
-- NEXT STEP: Trigger sync
-- ═══════════════════════════════════════════════════════════════
-- Option A - Use your app:
-- 1. Go to http://localhost:5173/integrations
-- 2. Click "Test Sync" button
-- 3. Wait for re-analysis to complete
--
-- Option B - Use Supabase Dashboard:
-- 1. Go to Functions → fathom-sync → Invoke
-- 2. Enter: {"sync_type": "manual", "limit": 10}
-- 3. Click "Run"
-- ═══════════════════════════════════════════════════════════════

-- Step 4: After sync, verify improved action items
-- Run this after waiting 2-5 minutes:
/*
SELECT
  'After re-analysis:' as status,
  COUNT(DISTINCT meeting_id) as meetings_with_action_items,
  COUNT(*) as total_action_items,
  ROUND(AVG(ai_confidence) * 100, 1) || '%' as avg_confidence
FROM meeting_action_items
WHERE ai_generated = true;

-- Show sample action items from recent meetings
SELECT
  m.title as meeting,
  mai.title as action_item,
  mai.assigned_to,
  mai.category,
  mai.priority,
  ROUND(mai.ai_confidence * 100, 0) || '%' as confidence
FROM meeting_action_items mai
JOIN meetings m ON m.id = mai.meeting_id
WHERE mai.ai_generated = true
  AND m.meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY m.meeting_start DESC, mai.priority DESC
LIMIT 20;
*/
