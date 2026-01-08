-- =====================================================
-- Health Score Performance Indexes
-- =====================================================
-- Indexes for fast health score queries and email lookups

-- Index for deal health scores by user and status
CREATE INDEX IF NOT EXISTS idx_deal_health_scores_user_status 
ON deal_health_scores(user_id, health_status, overall_health_score);

-- Index for deal health scores by last calculated time (for stale detection)
CREATE INDEX IF NOT EXISTS idx_deal_health_scores_last_calculated 
ON deal_health_scores(user_id, last_calculated_at DESC);

-- Index for relationship health scores by user and status
CREATE INDEX IF NOT EXISTS idx_relationship_health_scores_user_status 
ON relationship_health_scores(user_id, health_status, overall_health_score);

-- Index for relationship health scores by last calculated time
CREATE INDEX IF NOT EXISTS idx_relationship_health_scores_last_calculated 
ON relationship_health_scores(user_id, last_calculated_at DESC);

-- Index for relationship health ghost risk queries
CREATE INDEX IF NOT EXISTS idx_relationship_health_scores_ghost_risk 
ON relationship_health_scores(user_id, is_ghost_risk, ghost_probability_percent DESC) 
WHERE is_ghost_risk = true;

-- Index for communication events by deal and date (for health calculations)
CREATE INDEX IF NOT EXISTS idx_communication_events_deal_date 
ON communication_events(deal_id, communication_date DESC) 
WHERE deal_id IS NOT NULL;

-- Index for communication events by contact and date
CREATE INDEX IF NOT EXISTS idx_communication_events_contact_date 
ON communication_events(contact_id, communication_date DESC) 
WHERE contact_id IS NOT NULL;

-- Index for communication events by company and date
CREATE INDEX IF NOT EXISTS idx_communication_events_company_date 
ON communication_events(company_id, communication_date DESC) 
WHERE company_id IS NOT NULL;

-- Index for email sentiment queries
CREATE INDEX IF NOT EXISTS idx_communication_events_email_sentiment 
ON communication_events(deal_id, sentiment_score, communication_date DESC) 
WHERE deal_id IS NOT NULL 
  AND event_type IN ('email_sent', 'email_received') 
  AND sentiment_score IS NOT NULL;

-- Index for contacts by owner and email (for email sync matching)
-- NOTE: contacts table uses owner_id, not user_id
CREATE INDEX IF NOT EXISTS idx_contacts_owner_email 
ON contacts(owner_id, email) 
WHERE email IS NOT NULL;

-- Index for deals by owner and status (for health score calculations)
CREATE INDEX IF NOT EXISTS idx_deals_owner_status 
ON deals(owner_id, status, stage_id);

-- Index for meetings by deal and date (for health calculations)
-- NOTE: Meetings may be linked via deal_meetings junction table OR direct deal_id column
-- Conditionally create index on junction table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'deal_meetings'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_deal_meetings_deal_date 
    ON deal_meetings(deal_id, meeting_id);
  END IF;
END $$;

-- Index for meetings by date (for health calculations)
CREATE INDEX IF NOT EXISTS idx_meetings_date 
ON meetings(meeting_start DESC);

-- Conditionally create index on meetings.deal_id if column exists
-- (Some deployments may have direct deal_id column on meetings)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'deal_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_meetings_deal_date 
    ON meetings(deal_id, meeting_start DESC) 
    WHERE deal_id IS NOT NULL;
  END IF;
END $$;

-- Index for meetings by contact and date
CREATE INDEX IF NOT EXISTS idx_meetings_contact_date 
ON meetings(primary_contact_id, meeting_start DESC) 
WHERE primary_contact_id IS NOT NULL;

-- Comments
COMMENT ON INDEX idx_deal_health_scores_user_status IS 'Fast queries for deal health by user and status';
COMMENT ON INDEX idx_relationship_health_scores_user_status IS 'Fast queries for relationship health by user and status';
COMMENT ON INDEX idx_communication_events_deal_date IS 'Fast email/communication lookups for deal health calculations';
COMMENT ON INDEX idx_communication_events_email_sentiment IS 'Fast sentiment queries for email-based health scores';

