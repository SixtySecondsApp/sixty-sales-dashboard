-- Smart Engagement Algorithm - Phase 2: Notification Queue
-- Implements the notification queue for intelligent timing and frequency limiting

-- ============================================================================
-- Table: notification_queue
-- Queued notifications waiting to be sent at optimal times
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification content
  notification_type TEXT NOT NULL,           -- morning_brief, deal_alert, task_reminder, etc.
  channel TEXT NOT NULL CHECK (channel IN ('slack_dm', 'slack_channel', 'email', 'in_app')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),

  -- Payload
  payload JSONB NOT NULL DEFAULT '{}',       -- Channel-specific payload (blocks, subject, body, etc.)

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,        -- Earliest time to send
  optimal_send_time TIMESTAMPTZ,             -- Calculated optimal time
  optimal_time_confidence NUMERIC(3,2),      -- 0.00 to 1.00 confidence score
  send_deadline TIMESTAMPTZ,                 -- If not sent by this time, cancel

  -- Processing
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'processing', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  sent_at TIMESTAMPTZ,

  -- Result tracking
  notification_interaction_id UUID REFERENCES notification_interactions(id) ON DELETE SET NULL,

  -- Deduplication
  dedupe_key TEXT,                           -- Unique key for deduplication
  dedupe_window_minutes INTEGER DEFAULT 60,  -- Time window for deduplication

  -- Related entities
  related_entity_type TEXT,                  -- deal, meeting, contact, task
  related_entity_id UUID,

  -- Batching
  batch_id UUID,                             -- If part of a batch/digest
  is_batched BOOLEAN DEFAULT false,          -- Was merged into another notification

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- Indexes for queue processing
-- ============================================================================

-- Primary queue processing index - pending notifications ready to send
CREATE INDEX IF NOT EXISTS notification_queue_pending_idx
  ON notification_queue(scheduled_for, priority)
  WHERE status = 'pending';

-- User-specific queue lookup
CREATE INDEX IF NOT EXISTS notification_queue_user_status_idx
  ON notification_queue(user_id, status, scheduled_for);

-- Org-level queue monitoring
CREATE INDEX IF NOT EXISTS notification_queue_org_status_idx
  ON notification_queue(org_id, status);

-- Deduplication lookup
CREATE INDEX IF NOT EXISTS notification_queue_dedupe_idx
  ON notification_queue(user_id, dedupe_key, created_at)
  WHERE dedupe_key IS NOT NULL;

-- Batch grouping
CREATE INDEX IF NOT EXISTS notification_queue_batch_idx
  ON notification_queue(batch_id)
  WHERE batch_id IS NOT NULL;

-- Related entity lookup
CREATE INDEX IF NOT EXISTS notification_queue_entity_idx
  ON notification_queue(related_entity_type, related_entity_id);

-- Failed notifications for retry
CREATE INDEX IF NOT EXISTS notification_queue_retry_idx
  ON notification_queue(status, last_attempt_at, attempts)
  WHERE status = 'failed' AND attempts < 3;

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queued notifications"
  ON notification_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notification queue"
  ON notification_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Function: Queue a notification with optimal timing
-- ============================================================================
CREATE OR REPLACE FUNCTION queue_notification(
  p_user_id UUID,
  p_org_id UUID,
  p_notification_type TEXT,
  p_channel TEXT,
  p_payload JSONB,
  p_priority TEXT DEFAULT 'normal',
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  p_send_deadline TIMESTAMPTZ DEFAULT NULL,
  p_dedupe_key TEXT DEFAULT NULL,
  p_dedupe_window_minutes INTEGER DEFAULT 60,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_existing_id UUID;
  v_user_metrics RECORD;
  v_optimal_time TIMESTAMPTZ;
  v_confidence NUMERIC;
BEGIN
  -- Check for duplicate if dedupe_key provided
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM notification_queue
    WHERE user_id = p_user_id
      AND dedupe_key = p_dedupe_key
      AND status IN ('pending', 'scheduled')
      AND created_at > NOW() - (p_dedupe_window_minutes || ' minutes')::INTERVAL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Update existing notification instead of creating duplicate
      UPDATE notification_queue
      SET
        payload = p_payload,
        priority = CASE
          WHEN p_priority = 'urgent' THEN p_priority
          WHEN p_priority = 'high' AND priority != 'urgent' THEN p_priority
          ELSE priority
        END,
        metadata = metadata || p_metadata
      WHERE id = v_existing_id;

      RETURN v_existing_id;
    END IF;
  END IF;

  -- Get user engagement metrics for optimal timing
  SELECT
    peak_activity_hour,
    notification_fatigue_level,
    preferred_notification_frequency,
    typical_active_hours
  INTO v_user_metrics
  FROM user_engagement_metrics
  WHERE user_id = p_user_id;

  -- Calculate optimal send time (simplified - full logic in Edge Function)
  IF v_user_metrics.peak_activity_hour IS NOT NULL AND p_priority NOT IN ('urgent', 'high') THEN
    -- Schedule for peak activity hour if possible
    v_optimal_time := date_trunc('hour', p_scheduled_for) +
      (v_user_metrics.peak_activity_hour || ' hours')::INTERVAL;

    -- If peak hour is in the past today, schedule for tomorrow
    IF v_optimal_time < NOW() THEN
      v_optimal_time := v_optimal_time + INTERVAL '1 day';
    END IF;

    -- Ensure it's after scheduled_for
    IF v_optimal_time < p_scheduled_for THEN
      v_optimal_time := p_scheduled_for;
    END IF;

    v_confidence := 0.6;
  ELSE
    v_optimal_time := p_scheduled_for;
    v_confidence := 0.3;
  END IF;

  -- Insert into queue
  INSERT INTO notification_queue (
    user_id, org_id, notification_type, channel, payload, priority,
    scheduled_for, optimal_send_time, optimal_time_confidence, send_deadline,
    dedupe_key, dedupe_window_minutes,
    related_entity_type, related_entity_id, metadata
  )
  VALUES (
    p_user_id, p_org_id, p_notification_type, p_channel, p_payload, p_priority,
    p_scheduled_for, v_optimal_time, v_confidence, p_send_deadline,
    p_dedupe_key, p_dedupe_window_minutes,
    p_related_entity_type, p_related_entity_id, p_metadata
  )
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get pending notifications ready to send
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pending_notifications(
  p_limit INTEGER DEFAULT 50,
  p_channel TEXT DEFAULT NULL
)
RETURNS TABLE (
  queue_id UUID,
  user_id UUID,
  org_id UUID,
  notification_type TEXT,
  channel TEXT,
  priority TEXT,
  payload JSONB,
  scheduled_for TIMESTAMPTZ,
  optimal_send_time TIMESTAMPTZ,
  metadata JSONB,
  engagement_score INTEGER,
  notification_fatigue INTEGER,
  preferred_frequency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nq.id AS queue_id,
    nq.user_id,
    nq.org_id,
    nq.notification_type,
    nq.channel,
    nq.priority,
    nq.payload,
    nq.scheduled_for,
    nq.optimal_send_time,
    nq.metadata,
    uem.overall_engagement_score AS engagement_score,
    uem.notification_fatigue_level AS notification_fatigue,
    uem.preferred_notification_frequency AS preferred_frequency
  FROM notification_queue nq
  LEFT JOIN user_engagement_metrics uem ON uem.user_id = nq.user_id
  WHERE nq.status = 'pending'
    AND nq.scheduled_for <= NOW()
    AND (nq.send_deadline IS NULL OR nq.send_deadline > NOW())
    AND nq.is_batched = false
    AND (p_channel IS NULL OR nq.channel = p_channel)
  ORDER BY
    CASE nq.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    nq.scheduled_for
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Mark notification as processing (claim for sending)
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_notification_for_processing(
  p_queue_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE notification_queue
  SET
    status = 'processing',
    last_attempt_at = NOW(),
    attempts = attempts + 1
  WHERE id = p_queue_id
    AND status = 'pending'
  RETURNING 1 INTO v_updated;

  RETURN v_updated = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Mark notification as sent
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_notification_sent(
  p_queue_id UUID,
  p_interaction_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE notification_queue
  SET
    status = 'sent',
    sent_at = NOW(),
    notification_interaction_id = p_interaction_id
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Mark notification as failed
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_notification_failed(
  p_queue_id UUID,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE notification_queue
  SET
    status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
    error_message = p_error_message
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Cancel stale notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_stale_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH cancelled AS (
    UPDATE notification_queue
    SET status = 'cancelled'
    WHERE status IN ('pending', 'processing')
      AND (
        send_deadline < NOW()
        OR (status = 'processing' AND last_attempt_at < NOW() - INTERVAL '10 minutes')
        OR created_at < NOW() - INTERVAL '24 hours'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM cancelled;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get user's notification counts for rate limiting
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_notification_counts(
  p_user_id UUID
)
RETURNS TABLE (
  hour_count INTEGER,
  day_count INTEGER,
  last_sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT COUNT(*)::INTEGER FROM notification_queue
       WHERE user_id = p_user_id
         AND status = 'sent'
         AND sent_at > date_trunc('hour', NOW())),
      0
    ) AS hour_count,
    COALESCE(
      (SELECT COUNT(*)::INTEGER FROM notification_queue
       WHERE user_id = p_user_id
         AND status = 'sent'
         AND sent_at > date_trunc('day', NOW())),
      0
    ) AS day_count,
    (SELECT MAX(sent_at) FROM notification_queue
     WHERE user_id = p_user_id AND status = 'sent') AS last_sent_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION queue_notification(UUID, UUID, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_notifications(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION claim_notification_for_processing(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_sent(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_failed(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_stale_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_notification_counts(UUID) TO service_role;

-- ============================================================================
-- Schedule cron jobs
-- ============================================================================

-- Cancel stale notifications every 15 minutes
SELECT cron.schedule(
  'cancel-stale-notifications',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT cancel_stale_notifications()$$
);

-- Process notification queue every 5 minutes
-- Uses pg_net to call the Edge Function
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE notification_queue IS 'Queue for notifications with intelligent timing and rate limiting';
COMMENT ON FUNCTION queue_notification IS 'Add a notification to the queue with optimal timing calculation';
COMMENT ON FUNCTION get_pending_notifications IS 'Get notifications ready to be sent, ordered by priority';
COMMENT ON FUNCTION claim_notification_for_processing IS 'Atomically claim a notification for sending';
COMMENT ON FUNCTION mark_notification_sent IS 'Mark a notification as successfully sent';
COMMENT ON FUNCTION mark_notification_failed IS 'Mark a notification as failed, may retry';
COMMENT ON FUNCTION cancel_stale_notifications IS 'Cancel notifications that have passed their deadline';
COMMENT ON FUNCTION get_user_notification_counts IS 'Get notification counts for rate limiting';
