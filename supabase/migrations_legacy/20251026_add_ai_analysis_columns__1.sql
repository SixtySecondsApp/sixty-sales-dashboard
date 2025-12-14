-- Add AI analysis and retry tracking columns to meetings and meeting_action_items tables
-- Migration: 20251026_add_ai_analysis_columns

-- ============================================
-- meetings table updates
-- ============================================

-- Add transcript fetch retry tracking
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS transcript_fetch_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_transcript_fetch_at TIMESTAMPTZ;

-- Add AI-calculated metrics (if not already present from previous migrations)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS talk_time_rep_pct DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS talk_time_customer_pct DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS sentiment_reasoning TEXT;

-- Add talk time assessment field
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS talk_time_judgement TEXT;

-- ============================================
-- meeting_action_items table updates
-- ============================================

-- Add AI generation tracking
ALTER TABLE meeting_action_items
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Add assignee information for AI-extracted items
ALTER TABLE meeting_action_items
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS assigned_to_email TEXT;

-- Add deadline field (separate from timestamp)
ALTER TABLE meeting_action_items
ADD COLUMN IF NOT EXISTS deadline_date DATE;

-- ============================================
-- Indexes for performance
-- ============================================

-- Index for finding meetings that need transcript retry
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_retry
ON meetings(last_transcript_fetch_at, transcript_fetch_attempts)
WHERE transcript_text IS NULL AND transcript_fetch_attempts < 3;

-- Index for AI-generated action items
CREATE INDEX IF NOT EXISTS idx_action_items_ai_generated
ON meeting_action_items(ai_generated)
WHERE ai_generated = true;

-- Index for action items needing review
CREATE INDEX IF NOT EXISTS idx_action_items_needs_review
ON meeting_action_items(needs_review)
WHERE needs_review = true;

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON COLUMN meetings.transcript_fetch_attempts IS 'Number of times we''ve attempted to fetch the transcript from Fathom';
COMMENT ON COLUMN meetings.last_transcript_fetch_at IS 'Last time we attempted to fetch the transcript';
COMMENT ON COLUMN meetings.talk_time_rep_pct IS 'Sales rep talk time percentage calculated by Claude AI';
COMMENT ON COLUMN meetings.talk_time_customer_pct IS 'Customer talk time percentage calculated by Claude AI';
COMMENT ON COLUMN meetings.sentiment_score IS 'Overall call sentiment from -1.0 (negative) to 1.0 (positive) calculated by Claude AI';
COMMENT ON COLUMN meetings.sentiment_reasoning IS 'Explanation of sentiment score from Claude AI';
COMMENT ON COLUMN meetings.talk_time_judgement IS 'Assessment of talk time balance (e.g., "Balanced", "Too much rep talk")';

COMMENT ON COLUMN meeting_action_items.ai_generated IS 'Whether this action item was extracted by Claude AI from transcript';
COMMENT ON COLUMN meeting_action_items.ai_confidence IS 'AI confidence score 0.0 to 1.0 for this action item';
COMMENT ON COLUMN meeting_action_items.needs_review IS 'Whether this AI-generated item needs manual review';
COMMENT ON COLUMN meeting_action_items.assigned_to_name IS 'Name of person assigned (from AI extraction)';
COMMENT ON COLUMN meeting_action_items.assigned_to_email IS 'Email of person assigned (from AI extraction)';
COMMENT ON COLUMN meeting_action_items.deadline_date IS 'Deadline date for this action item';
