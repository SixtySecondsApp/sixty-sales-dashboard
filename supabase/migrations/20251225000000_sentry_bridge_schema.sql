-- Sentry Bridge Schema
-- Auto-ticketing from Sentry to AI Dev Hub via MCP
-- Part of the Sentry Integration Enhancement

-- ============================================================================
-- 1. sentry_bridge_config - Per-org configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_bridge_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Enable/disable the bridge for this org
  enabled BOOLEAN NOT NULL DEFAULT false,

  -- Sentry organization details
  sentry_org_slug TEXT,
  sentry_project_slugs TEXT[], -- Array of project slugs to process
  sentry_api_token_encrypted TEXT, -- Encrypted org API token for Sentry API calls

  -- Webhook authentication
  webhook_token TEXT, -- Token for webhook signature verification

  -- Service identity for MCP calls (never use per-user tokens)
  service_user_id UUID REFERENCES auth.users(id),
  service_mcp_token_encrypted TEXT,
  service_token_expires_at TIMESTAMPTZ,

  -- Default routing fallback
  default_dev_hub_project_id TEXT,
  default_owner_user_id UUID,
  default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),

  -- Triage mode (dry-run before auto-create)
  triage_mode_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Rate limiting
  max_tickets_per_hour INTEGER DEFAULT 50,
  max_tickets_per_day INTEGER DEFAULT 200,
  cooldown_same_issue_minutes INTEGER DEFAULT 5,

  -- Spike detection thresholds
  spike_threshold_count INTEGER DEFAULT 10, -- Issues within window = spike
  spike_threshold_minutes INTEGER DEFAULT 5,

  -- Circuit breaker
  circuit_breaker_failure_threshold INTEGER DEFAULT 5,
  circuit_breaker_cooldown_minutes INTEGER DEFAULT 15,
  circuit_breaker_tripped_at TIMESTAMPTZ,

  -- Privacy settings - allowlisted tags only
  allowlisted_tags TEXT[] DEFAULT ARRAY['deal_id', 'pipeline_stage', 'integration', 'operation', 'feature', 'org_id', 'environment', 'release'],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sentry_bridge_config_org_unique UNIQUE (org_id)
);

-- ============================================================================
-- 2. sentry_routing_rules - Rules engine for routing issues to projects/owners
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES sentry_bridge_config(id) ON DELETE CASCADE,

  -- Rule metadata
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
  enabled BOOLEAN NOT NULL DEFAULT true,
  test_mode BOOLEAN NOT NULL DEFAULT false, -- Log matches but don't route

  -- Matching conditions (all must match)
  match_sentry_project TEXT, -- Sentry project slug
  match_error_type TEXT, -- Regex for error type
  match_error_message TEXT, -- Regex for error message
  match_culprit TEXT, -- Regex for culprit (file/function)
  match_tags JSONB, -- Key-value pairs to match in tags
  match_environment TEXT, -- production, staging, development
  match_release_pattern TEXT, -- Regex for release version

  -- Routing destination
  target_dev_hub_project_id TEXT NOT NULL,
  target_owner_user_id UUID,
  target_priority TEXT DEFAULT 'medium' CHECK (target_priority IN ('low', 'medium', 'high', 'urgent')),

  -- Additional context for tickets
  attach_runbook_urls TEXT[], -- Links to runbooks/docs
  additional_labels TEXT[],
  notify_slack_channel TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentry_routing_rules_org ON sentry_routing_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_sentry_routing_rules_priority ON sentry_routing_rules(org_id, priority) WHERE enabled = true;

-- ============================================================================
-- 3. sentry_issue_mappings - Track Sentry issue → Dev Hub ticket mappings
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_issue_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Deduplication key: org_id + sentry_issue_id
  sentry_issue_id TEXT NOT NULL,
  sentry_project_slug TEXT NOT NULL,

  -- Dev Hub ticket reference
  dev_hub_task_id TEXT NOT NULL,
  dev_hub_project_id TEXT NOT NULL,

  -- Error fingerprint for similarity tracking
  error_hash TEXT, -- sha256(errorType + ':' + errorMessage + ':' + culprit)

  -- Current state
  sentry_status TEXT NOT NULL DEFAULT 'unresolved', -- unresolved, resolved, ignored
  dev_hub_status TEXT, -- Last known Dev Hub ticket status

  -- Latest event tracking
  latest_sentry_event_id TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_count INTEGER NOT NULL DEFAULT 1,

  -- Release info
  first_release TEXT,
  latest_release TEXT,

  -- Sentry external issue link ID (for bidirectional linking)
  sentry_external_issue_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sentry_issue_mappings_dedupe UNIQUE (org_id, sentry_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_sentry_issue_mappings_sentry_id ON sentry_issue_mappings(sentry_issue_id);
CREATE INDEX IF NOT EXISTS idx_sentry_issue_mappings_dev_hub ON sentry_issue_mappings(dev_hub_task_id);
CREATE INDEX IF NOT EXISTS idx_sentry_issue_mappings_error_hash ON sentry_issue_mappings(error_hash);

-- ============================================================================
-- 4. sentry_webhook_events - Raw webhook event log for debugging/replay
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event identification
  sentry_event_id TEXT NOT NULL,
  sentry_issue_id TEXT,
  event_type TEXT NOT NULL, -- issue.created, issue.resolved, issue.unresolved, issue.regression, etc.

  -- Raw payload (for debugging/replay)
  raw_payload JSONB NOT NULL,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'skipped')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Deduplication
  event_dedupe_key TEXT GENERATED ALWAYS AS (org_id::text || ':' || sentry_event_id) STORED,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sentry_webhook_events_dedupe UNIQUE (event_dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_sentry_webhook_events_org ON sentry_webhook_events(org_id);
CREATE INDEX IF NOT EXISTS idx_sentry_webhook_events_status ON sentry_webhook_events(status) WHERE status IN ('received', 'processing');
CREATE INDEX IF NOT EXISTS idx_sentry_webhook_events_received ON sentry_webhook_events(received_at DESC);

-- ============================================================================
-- 5. sentry_bridge_queue - Main processing queue with SKIP LOCKED pattern
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_bridge_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Reference to webhook event
  webhook_event_id UUID NOT NULL REFERENCES sentry_webhook_events(id) ON DELETE CASCADE,

  -- Parsed data (avoid re-parsing raw payload)
  sentry_issue_id TEXT NOT NULL,
  sentry_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Routing result (from rules engine or default)
  target_dev_hub_project_id TEXT NOT NULL,
  target_owner_user_id UUID,
  target_priority TEXT NOT NULL DEFAULT 'medium',
  routing_rule_id UUID REFERENCES sentry_routing_rules(id),

  -- Prepared ticket payload
  ticket_payload JSONB NOT NULL,

  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dlq')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,

  -- Processing lock
  locked_by TEXT,
  locked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sentry_bridge_queue_pending ON sentry_bridge_queue(next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sentry_bridge_queue_processing ON sentry_bridge_queue(locked_at)
  WHERE status = 'processing';

-- ============================================================================
-- 6. sentry_triage_queue - Items awaiting manual approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_triage_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Reference to webhook event
  webhook_event_id UUID NOT NULL REFERENCES sentry_webhook_events(id) ON DELETE CASCADE,

  -- Parsed issue data for display
  sentry_issue_id TEXT NOT NULL,
  sentry_project_slug TEXT NOT NULL,
  error_title TEXT NOT NULL,
  error_type TEXT,
  error_message TEXT,
  culprit TEXT,
  environment TEXT,
  release_version TEXT,
  event_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ,

  -- Suggested routing (from rules engine)
  suggested_dev_hub_project_id TEXT,
  suggested_owner_user_id UUID,
  suggested_priority TEXT,
  matched_rule_id UUID REFERENCES sentry_routing_rules(id),

  -- Prepared ticket payload
  ticket_payload JSONB NOT NULL,

  -- Triage status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  triaged_by UUID REFERENCES auth.users(id),
  triaged_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentry_triage_queue_pending ON sentry_triage_queue(created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sentry_triage_queue_org ON sentry_triage_queue(org_id, status);

-- ============================================================================
-- 7. sentry_dead_letter_queue - Failed items after max retries
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Original queue item ID
  original_queue_id UUID NOT NULL,
  queue_type TEXT NOT NULL CHECK (queue_type IN ('bridge', 'triage')),

  -- Reference to webhook event
  webhook_event_id UUID NOT NULL REFERENCES sentry_webhook_events(id) ON DELETE CASCADE,

  -- Issue data
  sentry_issue_id TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Original payload
  original_payload JSONB NOT NULL,

  -- Failure info
  failure_reason TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  last_error_details JSONB,

  -- Resolution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replayed', 'discarded')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentry_dlq_pending ON sentry_dead_letter_queue(created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sentry_dlq_org ON sentry_dead_letter_queue(org_id, status);

-- ============================================================================
-- 8. sentry_bridge_metrics - Aggregate metrics for monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentry_bridge_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time bucket (hourly aggregation)
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,

  -- Counts
  webhooks_received INTEGER NOT NULL DEFAULT 0,
  webhooks_processed INTEGER NOT NULL DEFAULT 0,
  webhooks_failed INTEGER NOT NULL DEFAULT 0,
  webhooks_skipped INTEGER NOT NULL DEFAULT 0,

  tickets_created INTEGER NOT NULL DEFAULT 0,
  tickets_updated INTEGER NOT NULL DEFAULT 0,
  tickets_triaged INTEGER NOT NULL DEFAULT 0,

  dlq_items INTEGER NOT NULL DEFAULT 0,

  -- Latency stats (ms)
  avg_processing_time_ms INTEGER,
  max_processing_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sentry_bridge_metrics_bucket UNIQUE (org_id, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_sentry_bridge_metrics_bucket ON sentry_bridge_metrics(org_id, bucket_start DESC);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sentry_bridge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sentry_bridge_config_updated_at
  BEFORE UPDATE ON sentry_bridge_config
  FOR EACH ROW EXECUTE FUNCTION update_sentry_bridge_updated_at();

CREATE TRIGGER sentry_routing_rules_updated_at
  BEFORE UPDATE ON sentry_routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_sentry_bridge_updated_at();

CREATE TRIGGER sentry_issue_mappings_updated_at
  BEFORE UPDATE ON sentry_issue_mappings
  FOR EACH ROW EXECUTE FUNCTION update_sentry_bridge_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sentry_bridge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_issue_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_bridge_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_triage_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_bridge_metrics ENABLE ROW LEVEL SECURITY;

-- Platform admins can read/write all Sentry Bridge data
CREATE POLICY "Platform admins can manage sentry_bridge_config"
  ON sentry_bridge_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can manage sentry_routing_rules"
  ON sentry_routing_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can view sentry_issue_mappings"
  ON sentry_issue_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can view sentry_webhook_events"
  ON sentry_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can manage sentry_bridge_queue"
  ON sentry_bridge_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can manage sentry_triage_queue"
  ON sentry_triage_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can manage sentry_dead_letter_queue"
  ON sentry_dead_letter_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can view sentry_bridge_metrics"
  ON sentry_bridge_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role bypasses RLS for Edge Functions

-- ============================================================================
-- Helper functions for the bridge worker
-- ============================================================================

-- Function to dequeue items with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION dequeue_sentry_bridge_item(
  batch_size INTEGER DEFAULT 1,
  lock_duration_seconds INTEGER DEFAULT 300
)
RETURNS SETOF sentry_bridge_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id TEXT;
BEGIN
  -- Generate a unique worker ID for this batch
  v_worker_id := 'worker-' || gen_random_uuid()::text;

  RETURN QUERY
  UPDATE sentry_bridge_queue
  SET
    status = 'processing',
    locked_by = v_worker_id,
    locked_at = now(),
    attempt_count = attempt_count + 1
  WHERE id IN (
    SELECT id FROM sentry_bridge_queue
    WHERE status = 'pending'
      AND next_attempt_at <= now()
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- Function to complete a queue item
CREATE OR REPLACE FUNCTION complete_sentry_bridge_item(
  item_id UUID,
  dev_hub_task_id TEXT,
  mapping_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sentry_bridge_queue
  SET
    status = 'completed',
    processed_at = now(),
    locked_by = NULL,
    locked_at = NULL
  WHERE id = item_id;
END;
$$;

-- Function to fail a queue item (retry or DLQ)
CREATE OR REPLACE FUNCTION fail_sentry_bridge_item(
  item_id UUID,
  error_msg TEXT,
  move_to_dlq BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item sentry_bridge_queue;
BEGIN
  SELECT * INTO v_item FROM sentry_bridge_queue WHERE id = item_id;

  IF move_to_dlq OR v_item.attempt_count >= v_item.max_attempts THEN
    -- Move to DLQ
    INSERT INTO sentry_dead_letter_queue (
      org_id,
      original_queue_id,
      queue_type,
      webhook_event_id,
      sentry_issue_id,
      event_type,
      original_payload,
      failure_reason,
      attempt_count,
      last_error_details
    ) VALUES (
      v_item.org_id,
      v_item.id,
      'bridge',
      v_item.webhook_event_id,
      v_item.sentry_issue_id,
      v_item.event_type,
      v_item.ticket_payload,
      error_msg,
      v_item.attempt_count,
      jsonb_build_object('error', error_msg, 'timestamp', now())
    );

    UPDATE sentry_bridge_queue
    SET status = 'dlq', last_error = error_msg
    WHERE id = item_id;
  ELSE
    -- Schedule retry with exponential backoff
    UPDATE sentry_bridge_queue
    SET
      status = 'pending',
      locked_by = NULL,
      locked_at = NULL,
      last_error = error_msg,
      next_attempt_at = now() + (power(2, v_item.attempt_count) * interval '1 minute')
    WHERE id = item_id;
  END IF;
END;
$$;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_sentry_bridge_rate_limit(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config sentry_bridge_config;
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
  v_allowed BOOLEAN := true;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_config FROM sentry_bridge_config WHERE org_id = p_org_id;

  IF v_config IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'No config found');
  END IF;

  -- Check circuit breaker
  IF v_config.circuit_breaker_tripped_at IS NOT NULL
     AND v_config.circuit_breaker_tripped_at + (v_config.circuit_breaker_cooldown_minutes * interval '1 minute') > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Circuit breaker tripped');
  END IF;

  -- Count tickets created in last hour
  SELECT COUNT(*) INTO v_hourly_count
  FROM sentry_bridge_queue
  WHERE org_id = p_org_id
    AND status = 'completed'
    AND processed_at > now() - interval '1 hour';

  IF v_hourly_count >= v_config.max_tickets_per_hour THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Hourly rate limit exceeded', 'count', v_hourly_count);
  END IF;

  -- Count tickets created today
  SELECT COUNT(*) INTO v_daily_count
  FROM sentry_bridge_queue
  WHERE org_id = p_org_id
    AND status = 'completed'
    AND processed_at > date_trunc('day', now());

  IF v_daily_count >= v_config.max_tickets_per_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Daily rate limit exceeded', 'count', v_daily_count);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'hourly_count', v_hourly_count,
    'daily_count', v_daily_count
  );
END;
$$;

-- Function to increment metrics
CREATE OR REPLACE FUNCTION increment_sentry_bridge_metrics(
  p_org_id UUID,
  p_date DATE,
  p_tickets_created INTEGER DEFAULT 0,
  p_tickets_updated INTEGER DEFAULT 0,
  p_errors INTEGER DEFAULT 0,
  p_processing_time_ms INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket_start TIMESTAMPTZ;
  v_bucket_end TIMESTAMPTZ;
BEGIN
  -- Use hourly buckets
  v_bucket_start := date_trunc('hour', now());
  v_bucket_end := v_bucket_start + interval '1 hour';

  INSERT INTO sentry_bridge_metrics (
    org_id,
    bucket_start,
    bucket_end,
    tickets_created,
    tickets_updated,
    webhooks_failed,
    avg_processing_time_ms
  ) VALUES (
    p_org_id,
    v_bucket_start,
    v_bucket_end,
    p_tickets_created,
    p_tickets_updated,
    p_errors,
    p_processing_time_ms
  )
  ON CONFLICT (org_id, bucket_start) DO UPDATE SET
    tickets_created = sentry_bridge_metrics.tickets_created + EXCLUDED.tickets_created,
    tickets_updated = sentry_bridge_metrics.tickets_updated + EXCLUDED.tickets_updated,
    webhooks_failed = sentry_bridge_metrics.webhooks_failed + EXCLUDED.webhooks_failed,
    avg_processing_time_ms = (
      (sentry_bridge_metrics.avg_processing_time_ms * sentry_bridge_metrics.webhooks_processed + EXCLUDED.avg_processing_time_ms) /
      NULLIF(sentry_bridge_metrics.webhooks_processed + 1, 0)
    ),
    webhooks_processed = sentry_bridge_metrics.webhooks_processed + 1;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION dequeue_sentry_bridge_item TO service_role;
GRANT EXECUTE ON FUNCTION complete_sentry_bridge_item TO service_role;
GRANT EXECUTE ON FUNCTION fail_sentry_bridge_item TO service_role;
GRANT EXECUTE ON FUNCTION check_sentry_bridge_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION increment_sentry_bridge_metrics TO service_role;
