-- =====================================================
-- RPC Functions for Health Score Refresh
-- =====================================================
-- These functions are called by scheduled edge functions to refresh health scores
-- They encapsulate the health calculation logic in PostgreSQL for better performance

-- =====================================================
-- Function: refresh_deal_health_scores
-- =====================================================
-- Refreshes health scores for all active deals owned by a user
-- Only refreshes scores that are stale (older than threshold)

CREATE OR REPLACE FUNCTION refresh_deal_health_scores(
  p_user_id UUID,
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  deal_id UUID,
  health_score INTEGER,
  health_status TEXT,
  updated BOOLEAN
) AS $$
DECLARE
  v_stale_threshold TIMESTAMP WITH TIME ZONE;
  v_deal RECORD;
  v_existing_score RECORD;
BEGIN
  -- Calculate stale threshold
  v_stale_threshold := NOW() - (p_max_age_hours || ' hours')::INTERVAL;

  -- Loop through active deals for this user
  FOR v_deal IN
    SELECT
      d.id,
      ds.name as stage_name,
      d.created_at,
      d.stage_id,
      d.one_off_amount,
      d.monthly_amount
    FROM deals d
    INNER JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE d.owner_id = p_user_id
      AND d.status = 'active'
      AND ds.name NOT IN ('Signed', 'Lost')
  LOOP
    -- Check if existing score is stale
    SELECT * INTO v_existing_score
    FROM deal_health_scores
    WHERE deal_id = v_deal.id
    ORDER BY last_calculated_at DESC
    LIMIT 1;

    -- Skip if score is fresh
    IF v_existing_score.id IS NOT NULL AND v_existing_score.last_calculated_at > v_stale_threshold THEN
      RETURN QUERY SELECT
        v_deal.id,
        v_existing_score.overall_health_score,
        v_existing_score.health_status::TEXT,
        FALSE;
      CONTINUE;
    END IF;

    -- Calculate days in current stage
    DECLARE
      v_days_in_stage INTEGER;
      v_stage_velocity_score INTEGER;
      v_overall_score INTEGER;
      v_health_status TEXT;
    BEGIN
      v_days_in_stage := EXTRACT(DAY FROM NOW() - v_deal.created_at)::INTEGER;

      -- Simple stage velocity calculation (can be enhanced)
      CASE v_deal.stage_name
        WHEN 'SQL' THEN
          IF v_days_in_stage <= 7 THEN v_stage_velocity_score := 100;
          ELSIF v_days_in_stage <= 14 THEN v_stage_velocity_score := 75;
          ELSIF v_days_in_stage <= 30 THEN v_stage_velocity_score := 50;
          ELSE v_stage_velocity_score := 25;
          END IF;
        WHEN 'Opportunity' THEN
          IF v_days_in_stage <= 14 THEN v_stage_velocity_score := 100;
          ELSIF v_days_in_stage <= 21 THEN v_stage_velocity_score := 75;
          ELSIF v_days_in_stage <= 45 THEN v_stage_velocity_score := 50;
          ELSE v_stage_velocity_score := 25;
          END IF;
        WHEN 'Verbal' THEN
          IF v_days_in_stage <= 7 THEN v_stage_velocity_score := 100;
          ELSIF v_days_in_stage <= 14 THEN v_stage_velocity_score := 75;
          ELSIF v_days_in_stage <= 21 THEN v_stage_velocity_score := 50;
          ELSE v_stage_velocity_score := 25;
          END IF;
        ELSE
          v_stage_velocity_score := 50;
      END CASE;

      -- Overall score is simplified for now (can be enhanced with sentiment, engagement, etc.)
      v_overall_score := v_stage_velocity_score;

      -- Determine health status
      IF v_overall_score >= 70 THEN v_health_status := 'healthy';
      ELSIF v_overall_score >= 50 THEN v_health_status := 'warning';
      ELSIF v_overall_score >= 30 THEN v_health_status := 'critical';
      ELSE v_health_status := 'stalled';
      END IF;

      -- Insert or update health score
      INSERT INTO deal_health_scores (
        deal_id,
        user_id,
        overall_health_score,
        health_status,
        stage_velocity_score,
        days_in_current_stage,
        sentiment_score,
        engagement_score,
        activity_score,
        response_time_score,
        risk_level,
        last_calculated_at
      ) VALUES (
        v_deal.id,
        p_user_id,
        v_overall_score,
        v_health_status,
        v_stage_velocity_score,
        v_days_in_stage,
        50, -- Default neutral
        50, -- Default neutral
        50, -- Default neutral
        50, -- Default neutral
        CASE
          WHEN v_overall_score >= 70 THEN 'low'
          WHEN v_overall_score >= 50 THEN 'medium'
          WHEN v_overall_score >= 30 THEN 'high'
          ELSE 'critical'
        END,
        NOW()
      )
      ON CONFLICT (deal_id)
      DO UPDATE SET
        overall_health_score = EXCLUDED.overall_health_score,
        health_status = EXCLUDED.health_status,
        stage_velocity_score = EXCLUDED.stage_velocity_score,
        days_in_current_stage = EXCLUDED.days_in_current_stage,
        risk_level = EXCLUDED.risk_level,
        last_calculated_at = NOW(),
        updated_at = NOW();

      RETURN QUERY SELECT
        v_deal.id,
        v_overall_score,
        v_health_status,
        TRUE;
    END;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: refresh_relationship_health_scores
-- =====================================================
-- Refreshes health scores for all contacts owned by a user

CREATE OR REPLACE FUNCTION refresh_relationship_health_scores(
  p_user_id UUID,
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  contact_id UUID,
  health_score INTEGER,
  health_status TEXT,
  updated BOOLEAN
) AS $$
DECLARE
  v_stale_threshold TIMESTAMP WITH TIME ZONE;
  v_contact RECORD;
  v_existing_score RECORD;
BEGIN
  -- Calculate stale threshold
  v_stale_threshold := NOW() - (p_max_age_hours || ' hours')::INTERVAL;

  -- Loop through contacts for this user
  -- NOTE: contacts table uses owner_id, not user_id
  FOR v_contact IN
    SELECT id, name, email
    FROM contacts
    WHERE owner_id = p_user_id
  LOOP
    -- Check if existing score is stale
    SELECT * INTO v_existing_score
    FROM relationship_health_scores
    WHERE contact_id = v_contact.id
      AND user_id = p_user_id
    ORDER BY last_calculated_at DESC
    LIMIT 1;

    -- Skip if score is fresh
    IF v_existing_score.id IS NOT NULL AND v_existing_score.last_calculated_at > v_stale_threshold THEN
      RETURN QUERY SELECT
        v_contact.id,
        v_existing_score.overall_health_score,
        v_existing_score.health_status::TEXT,
        FALSE;
      CONTINUE;
    END IF;

    -- Calculate health metrics
    DECLARE
      v_communication_count INTEGER;
      v_meeting_count INTEGER;
      v_days_since_contact INTEGER;
      v_overall_score INTEGER;
      v_health_status TEXT;
      v_risk_level TEXT;
    BEGIN
      -- Get communication count (last 30 days)
      SELECT COUNT(*) INTO v_communication_count
      FROM communication_events
      WHERE contact_id = v_contact.id
        AND user_id = p_user_id
        AND communication_date >= NOW() - INTERVAL '30 days';

      -- Get meeting count (last 30 days)
      SELECT COUNT(*) INTO v_meeting_count
      FROM meetings m
      INNER JOIN meeting_contacts mc ON m.id = mc.meeting_id
      WHERE mc.contact_id = v_contact.id
        AND m.owner_user_id = p_user_id
        AND m.meeting_start >= NOW() - INTERVAL '30 days';

      -- Calculate days since last contact
      SELECT
        EXTRACT(DAY FROM NOW() - MAX(communication_date))::INTEGER
      INTO v_days_since_contact
      FROM communication_events
      WHERE contact_id = v_contact.id
        AND user_id = p_user_id;

      -- Calculate overall score (simplified)
      v_overall_score := LEAST(100, (v_communication_count * 10) + (v_meeting_count * 20));

      -- Penalize for long gaps
      IF v_days_since_contact IS NOT NULL AND v_days_since_contact > 14 THEN
        v_overall_score := v_overall_score - ((v_days_since_contact - 14) * 2);
      END IF;

      v_overall_score := GREATEST(0, v_overall_score);

      -- Determine health status
      IF v_overall_score >= 70 THEN v_health_status := 'healthy';
      ELSIF v_overall_score >= 50 THEN v_health_status := 'at_risk';
      ELSIF v_overall_score >= 30 THEN v_health_status := 'critical';
      ELSE v_health_status := 'ghost';
      END IF;

      -- Determine risk level
      IF v_overall_score >= 70 THEN v_risk_level := 'low';
      ELSIF v_overall_score >= 50 THEN v_risk_level := 'medium';
      ELSIF v_overall_score >= 30 THEN v_risk_level := 'high';
      ELSE v_risk_level := 'critical';
      END IF;

      -- Insert or update health score
      INSERT INTO relationship_health_scores (
        user_id,
        relationship_type,
        contact_id,
        overall_health_score,
        health_status,
        risk_level,
        communication_frequency_score,
        days_since_last_contact,
        meeting_count_30_days,
        email_count_30_days,
        total_interactions_30_days,
        is_ghost_risk,
        ghost_probability_percent,
        last_calculated_at
      ) VALUES (
        p_user_id,
        'contact',
        v_contact.id,
        v_overall_score,
        v_health_status,
        v_risk_level,
        LEAST(100, v_communication_count * 25), -- Communication frequency score
        v_days_since_contact,
        v_meeting_count,
        v_communication_count,
        v_communication_count + v_meeting_count,
        v_overall_score < 30,
        CASE
          WHEN v_overall_score < 30 THEN 75
          WHEN v_overall_score < 50 THEN 40
          ELSE 10
        END,
        NOW()
      )
      ON CONFLICT (user_id, relationship_type, contact_id, company_id)
      DO UPDATE SET
        overall_health_score = EXCLUDED.overall_health_score,
        health_status = EXCLUDED.health_status,
        risk_level = EXCLUDED.risk_level,
        communication_frequency_score = EXCLUDED.communication_frequency_score,
        days_since_last_contact = EXCLUDED.days_since_last_contact,
        meeting_count_30_days = EXCLUDED.meeting_count_30_days,
        email_count_30_days = EXCLUDED.email_count_30_days,
        total_interactions_30_days = EXCLUDED.total_interactions_30_days,
        is_ghost_risk = EXCLUDED.is_ghost_risk,
        ghost_probability_percent = EXCLUDED.ghost_probability_percent,
        last_calculated_at = NOW(),
        updated_at = NOW();

      RETURN QUERY SELECT
        v_contact.id,
        v_overall_score,
        v_health_status,
        TRUE;
    END;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON FUNCTION refresh_deal_health_scores IS 'Refreshes health scores for active deals owned by user. Only updates stale scores (older than max_age_hours).';
COMMENT ON FUNCTION refresh_relationship_health_scores IS 'Refreshes health scores for all contacts owned by user. Only updates stale scores (older than max_age_hours).';
