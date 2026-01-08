-- ============================================================================
-- BILLING EVENT LOG
-- Provider-agnostic event log for subscription analytics
-- Supports Stripe now, Apple/Google/RevenueCat later
-- ============================================================================

-- ============================================================================
-- BILLING EVENT LOG TABLE
-- ============================================================================
-- Append-only log of all billing events from any provider
CREATE TABLE IF NOT EXISTS billing_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'apple', 'google', 'revenuecat')),
  provider_event_id TEXT NOT NULL, -- Provider's event ID (e.g., Stripe event.id)
  
  -- Event details
  event_type TEXT NOT NULL, -- Normalized event type (subscription_created, payment_received, etc.)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Organization context (billing is org-level in our app)
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Raw payload for audit/debugging
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Processing status
  processed_at TIMESTAMPTZ, -- When we processed this event
  processing_error TEXT, -- Error message if processing failed
  
  -- Metadata for analytics
  metadata JSONB DEFAULT '{}', -- Extracted fields for easier querying
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure idempotency: same provider + provider_event_id can only exist once
  CONSTRAINT unique_provider_event UNIQUE (provider, provider_event_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_billing_event_log_org_id ON billing_event_log(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_event_type ON billing_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_occurred_at ON billing_event_log(occurred_at);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_provider ON billing_event_log(provider);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_processed_at ON billing_event_log(processed_at) WHERE processed_at IS NULL; -- For finding unprocessed events

-- Composite index for common queries (org + event type + date range)
CREATE INDEX IF NOT EXISTS idx_billing_event_log_org_type_date ON billing_event_log(org_id, event_type, occurred_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE billing_event_log ENABLE ROW LEVEL SECURITY;

-- Service role can insert (for webhooks)
CREATE POLICY "Service role can insert billing events"
  ON billing_event_log FOR INSERT
  WITH CHECK (is_service_role());

-- Admins can view all events
CREATE POLICY "Admins can view billing events"
  ON billing_event_log FOR SELECT
  USING (is_admin_optimized());

-- Org admins can view their org's events
CREATE POLICY "Org admins can view their billing events"
  ON billing_event_log FOR SELECT
  USING (
    org_id IS NOT NULL AND
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get unprocessed events (for retry/reconciliation)
CREATE OR REPLACE FUNCTION get_unprocessed_billing_events(
  p_provider TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  provider_event_id TEXT,
  event_type TEXT,
  occurred_at TIMESTAMPTZ,
  org_id UUID,
  payload JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bel.id,
    bel.provider,
    bel.provider_event_id,
    bel.event_type,
    bel.occurred_at,
    bel.org_id,
    bel.payload
  FROM billing_event_log bel
  WHERE bel.processed_at IS NULL
    AND (p_provider IS NULL OR bel.provider = p_provider)
  ORDER BY bel.occurred_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark event as processed
CREATE OR REPLACE FUNCTION mark_billing_event_processed(
  p_id UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE billing_event_log
  SET
    processed_at = NOW(),
    processing_error = p_error
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE billing_event_log IS 'Provider-agnostic append-only log of all billing events for analytics';
COMMENT ON COLUMN billing_event_log.provider IS 'Billing provider: stripe, apple, google, revenuecat';
COMMENT ON COLUMN billing_event_log.provider_event_id IS 'Provider-specific event ID for idempotency';
COMMENT ON COLUMN billing_event_log.event_type IS 'Normalized event type (subscription_created, payment_received, etc.)';
COMMENT ON COLUMN billing_event_log.payload IS 'Raw event payload from provider for audit/debugging';
COMMENT ON COLUMN billing_event_log.metadata IS 'Extracted fields for easier querying (e.g., amount, currency, plan_id)';
COMMENT ON FUNCTION get_unprocessed_billing_events IS 'Get unprocessed events for retry/reconciliation';
COMMENT ON FUNCTION mark_billing_event_processed IS 'Mark an event as processed (with optional error)';
