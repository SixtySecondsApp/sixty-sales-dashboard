-- Create tables for aggregated meeting insights
-- These tables store pre-computed analytics for contacts and companies

-- Contact Meeting Insights Table
CREATE TABLE IF NOT EXISTS contact_meeting_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,

  -- Meeting statistics
  total_meetings INTEGER DEFAULT 0,
  last_meeting_date TIMESTAMPTZ,
  next_suggested_followup TIMESTAMPTZ,

  -- Sentiment analysis
  avg_sentiment_score NUMERIC CHECK (avg_sentiment_score >= -1 AND avg_sentiment_score <= 1),
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),

  -- Talk time analysis
  avg_talk_time_customer_pct NUMERIC CHECK (avg_talk_time_customer_pct >= 0 AND avg_talk_time_customer_pct <= 100),

  -- Engagement metrics
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  response_rate NUMERIC CHECK (response_rate >= 0 AND response_rate <= 100),

  -- Topics and insights (arrays for flexibility)
  key_topics TEXT[],
  pain_points TEXT[],
  objections TEXT[],
  decision_criteria TEXT[],
  competitors_mentioned TEXT[],

  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  insights_summary TEXT
);

-- Company Meeting Insights Table
CREATE TABLE IF NOT EXISTS company_meeting_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Meeting statistics
  total_meetings INTEGER DEFAULT 0,
  total_contacts_met INTEGER DEFAULT 0,
  last_meeting_date TIMESTAMPTZ,

  -- Sentiment analysis
  avg_sentiment_score NUMERIC CHECK (avg_sentiment_score >= -1 AND avg_sentiment_score <= 1),
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),

  -- Engagement metrics
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  meeting_frequency_days NUMERIC, -- Average days between meetings

  -- Deal stage inference
  inferred_deal_stage TEXT CHECK (inferred_deal_stage IN ('research', 'evaluation', 'negotiation', 'decision', 'unknown')),
  deal_probability INTEGER CHECK (deal_probability >= 0 AND deal_probability <= 100),

  -- Topics and insights
  key_topics TEXT[],
  pain_points TEXT[],
  decision_makers TEXT[], -- Names or roles of identified decision makers
  competitors_mentioned TEXT[],

  -- Decision-making process
  buying_committee_size INTEGER,
  decision_timeline_days INTEGER,

  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  insights_summary TEXT
);

-- Indexes for performance
CREATE INDEX idx_contact_insights_contact ON contact_meeting_insights(contact_id);
CREATE INDEX idx_contact_insights_last_meeting ON contact_meeting_insights(last_meeting_date DESC);
CREATE INDEX idx_contact_insights_engagement ON contact_meeting_insights(engagement_score DESC);
CREATE INDEX idx_contact_insights_sentiment ON contact_meeting_insights(avg_sentiment_score DESC);

CREATE INDEX idx_company_insights_company ON company_meeting_insights(company_id);
CREATE INDEX idx_company_insights_last_meeting ON company_meeting_insights(last_meeting_date DESC);
CREATE INDEX idx_company_insights_engagement ON company_meeting_insights(engagement_score DESC);
CREATE INDEX idx_company_insights_deal_probability ON company_meeting_insights(deal_probability DESC);

-- Comments for documentation
COMMENT ON TABLE contact_meeting_insights IS 'Aggregated meeting intelligence per contact';
COMMENT ON TABLE company_meeting_insights IS 'Aggregated meeting intelligence per company';

COMMENT ON COLUMN contact_meeting_insights.engagement_score IS 'Overall engagement score (0-100) based on meeting frequency, sentiment, and response rate';
COMMENT ON COLUMN contact_meeting_insights.sentiment_trend IS 'Trend of sentiment over recent meetings';
COMMENT ON COLUMN contact_meeting_insights.key_topics IS 'Array of key topics discussed across meetings';
COMMENT ON COLUMN contact_meeting_insights.pain_points IS 'Array of pain points mentioned in meetings';
COMMENT ON COLUMN contact_meeting_insights.decision_criteria IS 'Array of decision criteria mentioned';

COMMENT ON COLUMN company_meeting_insights.engagement_score IS 'Overall company engagement score (0-100)';
COMMENT ON COLUMN company_meeting_insights.inferred_deal_stage IS 'Deal stage inferred from meeting patterns';
COMMENT ON COLUMN company_meeting_insights.deal_probability IS 'Estimated probability of closing deal (0-100)';
COMMENT ON COLUMN company_meeting_insights.decision_makers IS 'Identified decision makers from meeting analysis';
