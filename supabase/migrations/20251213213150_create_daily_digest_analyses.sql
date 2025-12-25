-- Migration: Create daily_digest_analyses table
-- Stores org + per-user daily digests for historical browsing, dashboards, and future RAG/analysis workflows.

-- Create the table
CREATE TABLE IF NOT EXISTS daily_digest_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity & scope
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  digest_type TEXT NOT NULL CHECK (digest_type IN ('org', 'user')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Time window (the analyzed period)
  timezone TEXT NOT NULL DEFAULT 'UTC',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  
  -- Source (e.g. 'slack_daily_digest', 'manual_backfill')
  source TEXT NOT NULL DEFAULT 'slack_daily_digest',
  
  -- Input snapshot: the raw counts and key items used to build the digest
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Highlights: structured "what matters" (top meetings, overdue tasks, stale deals, AI insights)
  highlights JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Rendered text: compact plain/markdown version for downstream workflows
  rendered_text TEXT NOT NULL DEFAULT '',
  
  -- Slack message: the Block Kit blocks + fallback text
  slack_message JSONB,
  
  -- Delivery metadata: channelId, ts, status, errors
  delivery JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT user_required_for_user_digest CHECK (
    (digest_type = 'user' AND user_id IS NOT NULL) OR
    (digest_type = 'org' AND user_id IS NULL)
  )
);

-- Unique index to enforce idempotency (one digest per org+date+type+user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_digest_analyses_unique
ON daily_digest_analyses (
  org_id,
  digest_date,
  digest_type,
  COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_digest_analyses_org_date
ON daily_digest_analyses (org_id, digest_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_digest_analyses_user
ON daily_digest_analyses (user_id, digest_date DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_digest_analyses_type
ON daily_digest_analyses (digest_type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_daily_digest_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_daily_digest_analyses_updated_at ON daily_digest_analyses;
CREATE TRIGGER update_daily_digest_analyses_updated_at
  BEFORE UPDATE ON daily_digest_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_digest_analyses_updated_at();

-- Enable RLS
ALTER TABLE daily_digest_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Select: org members can read digests for their org
CREATE POLICY "Org members can view daily digests"
ON daily_digest_analyses
FOR SELECT
USING (
  org_id IN (
    SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
  )
);

-- Insert: service role only (edge functions insert digests)
-- No explicit policy needed as service role bypasses RLS

-- Update: service role only (for upsert scenarios)
-- No explicit policy needed as service role bypasses RLS

-- Grant permissions
GRANT SELECT ON daily_digest_analyses TO authenticated;
GRANT ALL ON daily_digest_analyses TO service_role;

-- Comments
COMMENT ON TABLE daily_digest_analyses IS 'Stores daily digest analyses (org + per-user) for historical browsing and future RAG/analysis workflows';
COMMENT ON COLUMN daily_digest_analyses.digest_type IS 'Type of digest: org (one per org per day) or user (one per org+user per day)';
COMMENT ON COLUMN daily_digest_analyses.input_snapshot IS 'Raw counts and key items used to build the digest';
COMMENT ON COLUMN daily_digest_analyses.highlights IS 'Structured highlights: top meetings, overdue tasks, stale deals, AI insights';
COMMENT ON COLUMN daily_digest_analyses.rendered_text IS 'Compact plain/markdown digest for downstream workflows';
COMMENT ON COLUMN daily_digest_analyses.slack_message IS 'Block Kit blocks + fallback text sent to Slack';
COMMENT ON COLUMN daily_digest_analyses.delivery IS 'Delivery metadata: channelId, ts, status, errors';










