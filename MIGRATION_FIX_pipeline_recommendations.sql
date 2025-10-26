-- Fixed version of 20251025000007_create_pipeline_sentiment_recommendations.sql
-- Fix: Line 257 - Changed GET DIAGNOSTICS syntax from "ROW_COUNT > 0" to just "ROW_COUNT"
-- Then check the value separately

-- Pipeline Sentiment Recommendations Table
-- Stores AI-suggested pipeline stage changes based on meeting sentiment
-- Supports Human-in-the-Loop (HITL) approval workflow

CREATE TABLE IF NOT EXISTS pipeline_stage_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Meeting and deal context
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Current state
  current_stage TEXT NOT NULL,

  -- Recommendation
  recommended_stage TEXT NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  recommendation_reason TEXT,

  -- Sentiment analysis that triggered recommendation
  meeting_sentiment_score NUMERIC CHECK (meeting_sentiment_score >= -1 AND meeting_sentiment_score <= 1),
  meeting_summary TEXT,
  key_signals TEXT[], -- Array of key signals that influenced recommendation

  -- HITL workflow
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'auto_applied', 'expired')) DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,

  -- Auto-apply settings
  auto_apply_enabled BOOLEAN DEFAULT FALSE,
  auto_apply_threshold NUMERIC DEFAULT 0.85, -- Confidence threshold for auto-apply

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- Recommendations expire after 7 days

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_meeting ON pipeline_stage_recommendations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_deal ON pipeline_stage_recommendations(deal_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_company ON pipeline_stage_recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_user ON pipeline_stage_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_status ON pipeline_stage_recommendations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pipeline_recommendations_created ON pipeline_stage_recommendations(created_at DESC);

-- Comments
COMMENT ON TABLE pipeline_stage_recommendations IS 'AI-generated pipeline stage recommendations based on meeting sentiment with HITL approval';
COMMENT ON COLUMN pipeline_stage_recommendations.confidence_score IS 'AI confidence in recommendation (0-1)';
COMMENT ON COLUMN pipeline_stage_recommendations.status IS 'pending: awaiting review, approved: user accepted, rejected: user declined, auto_applied: auto-approved above threshold, expired: recommendation too old';
COMMENT ON COLUMN pipeline_stage_recommendations.auto_apply_enabled IS 'If true and confidence > threshold, automatically apply recommendation';
COMMENT ON COLUMN pipeline_stage_recommendations.key_signals IS 'Array of key phrases/signals that influenced the recommendation';

-- Function to generate pipeline stage recommendation based on meeting sentiment
CREATE OR REPLACE FUNCTION generate_pipeline_recommendation_from_meeting(
  p_meeting_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_meeting RECORD;
  v_deal RECORD;
  v_recommended_stage TEXT;
  v_confidence NUMERIC;
  v_reason TEXT;
  v_key_signals TEXT[];
  v_recommendation_id UUID;
BEGIN
  -- Get meeting details
  SELECT
    m.id,
    m.company_id,
    m.primary_contact_id,
    m.sentiment_score,
    m.summary,
    m.coach_rating,
    m.talk_time_judgement
  INTO v_meeting
  FROM meetings m
  WHERE m.id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found: %', p_meeting_id;
  END IF;

  -- Find active deal for this company
  SELECT
    d.id,
    d.stage,
    d.company_id
  INTO v_deal
  FROM deals d
  WHERE d.company_id = v_meeting.company_id
    AND d.owner_id = p_user_id  -- FIXED: Changed from user_id to owner_id
    AND d.stage NOT IN ('Signed', 'Lost') -- Only active deals
  ORDER BY d.created_at DESC
  LIMIT 1;

  -- If no active deal found, skip recommendation
  IF NOT FOUND THEN
    RAISE NOTICE 'No active deal found for company, skipping recommendation';
    RETURN NULL;
  END IF;

  -- Determine recommended stage based on sentiment and current stage
  -- Business logic for 4-stage pipeline: SQL → Opportunity → Verbal → Signed

  v_key_signals := ARRAY[]::TEXT[];

  CASE v_deal.stage
    WHEN 'SQL' THEN
      -- SQL → Opportunity transition
      -- Positive sentiment (>0.3) suggests moving to Opportunity
      IF v_meeting.sentiment_score >= 0.3 THEN
        v_recommended_stage := 'Opportunity';
        v_confidence := LEAST(1.0, v_meeting.sentiment_score + 0.3);
        v_reason := 'Positive meeting sentiment suggests prospect is ready for proposal stage';
        v_key_signals := ARRAY['positive_sentiment', 'discovery_complete'];
      ELSIF v_meeting.sentiment_score >= 0.0 THEN
        v_recommended_stage := 'SQL'; -- Stay in SQL
        v_confidence := 0.5;
        v_reason := 'Neutral sentiment - continue discovery';
        v_key_signals := ARRAY['neutral_sentiment', 'more_discovery_needed'];
      ELSE
        v_recommended_stage := 'SQL'; -- Stay or consider disqualifying
        v_confidence := 0.3;
        v_reason := 'Negative sentiment - may need to re-qualify or address concerns';
        v_key_signals := ARRAY['negative_sentiment', 'objections_present'];
      END IF;

    WHEN 'Opportunity' THEN
      -- Opportunity → Verbal transition
      -- High positive sentiment (>0.5) suggests verbal commitment
      IF v_meeting.sentiment_score >= 0.5 THEN
        v_recommended_stage := 'Verbal';
        v_confidence := LEAST(1.0, v_meeting.sentiment_score + 0.2);
        v_reason := 'Strong positive sentiment indicates verbal commitment likely';
        v_key_signals := ARRAY['strong_positive_sentiment', 'commitment_signals'];
      ELSIF v_meeting.sentiment_score >= 0.2 THEN
        v_recommended_stage := 'Opportunity'; -- Stay
        v_confidence := 0.6;
        v_reason := 'Positive progress but not yet ready for verbal commitment';
        v_key_signals := ARRAY['positive_progress', 'negotiation_ongoing'];
      ELSE
        v_recommended_stage := 'SQL'; -- Consider moving back
        v_confidence := 0.4;
        v_reason := 'Concerns raised - may need to revisit discovery';
        v_key_signals := ARRAY['concerns_raised', 'back_to_discovery'];
      END IF;

    WHEN 'Verbal' THEN
      -- Verbal → Signed transition
      -- Very high sentiment (>0.6) suggests ready to close
      IF v_meeting.sentiment_score >= 0.6 THEN
        v_recommended_stage := 'Signed';
        v_confidence := LEAST(1.0, v_meeting.sentiment_score + 0.15);
        v_reason := 'Excellent sentiment - deal likely to close';
        v_key_signals := ARRAY['very_positive_sentiment', 'ready_to_close'];
      ELSIF v_meeting.sentiment_score >= 0.3 THEN
        v_recommended_stage := 'Verbal'; -- Stay
        v_confidence := 0.7;
        v_reason := 'Positive but awaiting final approvals';
        v_key_signals := ARRAY['awaiting_approval', 'positive_signals'];
      ELSE
        v_recommended_stage := 'Opportunity'; -- Move back if issues
        v_confidence := 0.5;
        v_reason := 'Issues detected - may need to renegotiate';
        v_key_signals := ARRAY['issues_detected', 'renegotiation_needed'];
      END IF;

    ELSE
      -- For other stages, no automatic recommendation
      RETURN NULL;
  END CASE;

  -- Only create recommendation if stage is different from current
  IF v_recommended_stage = v_deal.stage THEN
    RAISE NOTICE 'Recommended stage same as current, skipping recommendation';
    RETURN NULL;
  END IF;

  -- Create recommendation
  INSERT INTO pipeline_stage_recommendations (
    meeting_id,
    deal_id,
    company_id,
    contact_id,
    user_id,
    current_stage,
    recommended_stage,
    confidence_score,
    recommendation_reason,
    meeting_sentiment_score,
    meeting_summary,
    key_signals,
    status
  ) VALUES (
    p_meeting_id,
    v_deal.id,
    v_meeting.company_id,
    v_meeting.primary_contact_id,
    p_user_id,
    v_deal.stage,
    v_recommended_stage,
    v_confidence,
    v_reason,
    v_meeting.sentiment_score,
    v_meeting.summary,
    v_key_signals,
    'pending'
  )
  RETURNING id INTO v_recommendation_id;

  RAISE NOTICE 'Created pipeline recommendation: % → % (confidence: %)',
    v_deal.stage, v_recommended_stage, v_confidence;

  RETURN v_recommendation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to approve and apply recommendation
CREATE OR REPLACE FUNCTION approve_pipeline_recommendation(
  p_recommendation_id UUID,
  p_reviewed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_recommendation RECORD;
  v_rows_affected INTEGER;
BEGIN
  -- Get recommendation
  SELECT *
  INTO v_recommendation
  FROM pipeline_stage_recommendations
  WHERE id = p_recommendation_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation not found or already processed';
  END IF;

  -- Update deal stage
  UPDATE deals
  SET
    stage = v_recommendation.recommended_stage,
    updated_at = NOW()
  WHERE id = v_recommendation.deal_id;

  -- FIXED: Correct syntax for GET DIAGNOSTICS
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected > 0 THEN
    -- Mark recommendation as approved
    UPDATE pipeline_stage_recommendations
    SET
      status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = p_reviewed_by,
      review_notes = p_notes
    WHERE id = p_recommendation_id;

    RAISE NOTICE 'Deal % moved from % to %',
      v_recommendation.deal_id,
      v_recommendation.current_stage,
      v_recommendation.recommended_stage;

    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Failed to update deal stage';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reject recommendation
CREATE OR REPLACE FUNCTION reject_pipeline_recommendation(
  p_recommendation_id UUID,
  p_reviewed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE pipeline_stage_recommendations
  SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = p_reviewed_by,
    review_notes = p_notes
  WHERE id = p_recommendation_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-apply high-confidence recommendations
CREATE OR REPLACE FUNCTION auto_apply_pipeline_recommendations()
RETURNS INTEGER AS $$
DECLARE
  v_recommendation RECORD;
  v_applied_count INTEGER := 0;
BEGIN
  -- Find pending recommendations that meet auto-apply criteria
  FOR v_recommendation IN
    SELECT *
    FROM pipeline_stage_recommendations
    WHERE status = 'pending'
      AND auto_apply_enabled = TRUE
      AND confidence_score >= auto_apply_threshold
      AND expires_at > NOW()
  LOOP
    BEGIN
      -- Update deal stage
      UPDATE deals
      SET
        stage = v_recommendation.recommended_stage,
        updated_at = NOW()
      WHERE id = v_recommendation.deal_id;

      -- Mark as auto-applied
      UPDATE pipeline_stage_recommendations
      SET
        status = 'auto_applied',
        reviewed_at = NOW()
      WHERE id = v_recommendation.id;

      v_applied_count := v_applied_count + 1;

      RAISE NOTICE 'Auto-applied recommendation: % → %',
        v_recommendation.current_stage,
        v_recommendation.recommended_stage;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to auto-apply recommendation %: %',
        v_recommendation.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_applied_count;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old recommendations
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE pipeline_stage_recommendations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON pipeline_stage_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION generate_pipeline_recommendation_from_meeting TO authenticated;
GRANT EXECUTE ON FUNCTION approve_pipeline_recommendation TO authenticated;
GRANT EXECUTE ON FUNCTION reject_pipeline_recommendation TO authenticated;
GRANT EXECUTE ON FUNCTION auto_apply_pipeline_recommendations TO service_role;
GRANT EXECUTE ON FUNCTION expire_old_recommendations TO service_role;
