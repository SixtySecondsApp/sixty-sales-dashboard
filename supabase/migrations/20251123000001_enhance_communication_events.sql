-- =====================================================
-- Enhance Communication Events for Email Sync
-- =====================================================
-- Add email-specific fields and AI analysis columns
-- Supports Gmail sync with Claude Haiku 4.5 analysis

-- Add email-specific fields
ALTER TABLE communication_events
ADD COLUMN IF NOT EXISTS email_thread_id TEXT,
ADD COLUMN IF NOT EXISTS email_subject TEXT,
ADD COLUMN IF NOT EXISTS email_body_preview TEXT,
ADD COLUMN IF NOT EXISTS response_time_hours NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_model TEXT, -- 'claude-haiku-4-5-20251001'
ADD COLUMN IF NOT EXISTS key_topics JSONB,
ADD COLUMN IF NOT EXISTS action_items JSONB,
ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS response_required BOOLEAN,
ADD COLUMN IF NOT EXISTS external_id TEXT, -- Gmail message ID
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('gmail', 'manual', 'calendar', 'fathom'));

-- Add communication_date column if it doesn't exist (alias for event_timestamp)
-- This is used for consistency with health score queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'communication_events' 
    AND column_name = 'communication_date'
  ) THEN
    ALTER TABLE communication_events ADD COLUMN communication_date TIMESTAMP WITH TIME ZONE;
    -- Populate from event_timestamp
    UPDATE communication_events SET communication_date = event_timestamp WHERE communication_date IS NULL;
    -- Set as NOT NULL after population
    ALTER TABLE communication_events ALTER COLUMN communication_date SET NOT NULL;
    -- Set default to event_timestamp
    ALTER TABLE communication_events ALTER COLUMN communication_date SET DEFAULT NOW();
  END IF;
END $$;

-- Unique index for Gmail message deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_gmail_id 
ON communication_events(external_id, user_id) 
WHERE external_id IS NOT NULL AND sync_source = 'gmail';

-- Index for incremental sync
CREATE INDEX IF NOT EXISTS idx_communication_events_sync_date 
ON communication_events(user_id, communication_date DESC, sync_source);

-- Index for AI analysis status
CREATE INDEX IF NOT EXISTS idx_communication_events_ai_pending 
ON communication_events(user_id, ai_analyzed) 
WHERE ai_analyzed = false AND sync_source = 'gmail';

-- Index for email lookups by deal
CREATE INDEX IF NOT EXISTS idx_communication_events_deal_email 
ON communication_events(deal_id, event_type, communication_date DESC) 
WHERE deal_id IS NOT NULL AND event_type IN ('email_sent', 'email_received');

-- Index for sentiment analysis queries
CREATE INDEX IF NOT EXISTS idx_communication_events_sentiment 
ON communication_events(deal_id, sentiment_score, communication_date DESC) 
WHERE deal_id IS NOT NULL AND sentiment_score IS NOT NULL;

-- Comments
COMMENT ON COLUMN communication_events.ai_analyzed IS 'Whether Claude Haiku 4.5 has analyzed this email';
COMMENT ON COLUMN communication_events.ai_model IS 'AI model used for analysis (e.g., claude-haiku-4-5-20251001)';
COMMENT ON COLUMN communication_events.email_thread_id IS 'Gmail thread ID for grouping related emails';
COMMENT ON COLUMN communication_events.external_id IS 'Gmail message ID for deduplication';
COMMENT ON COLUMN communication_events.sync_source IS 'Source of the communication event (gmail, manual, calendar, fathom)';
COMMENT ON COLUMN communication_events.key_topics IS 'AI-extracted key topics from email (JSONB array)';
COMMENT ON COLUMN communication_events.action_items IS 'AI-extracted action items from email (JSONB array)';
COMMENT ON COLUMN communication_events.urgency IS 'AI-determined urgency level (low, medium, high)';
COMMENT ON COLUMN communication_events.response_required IS 'Whether AI determined a response is required';














