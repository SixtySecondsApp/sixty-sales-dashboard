-- Migration: Skill Refresh Triggers and Queue System
-- Phase 6: Auto-Refresh System for Agent-Executable Skills Platform
-- Date: 2026-01-01

-- =============================================================================
-- Table: platform_skills_refresh_queue
-- Queue for tracking pending skill refresh jobs
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_skills_refresh_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  skill_key TEXT REFERENCES platform_skills(skill_key),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Job type: 'skill_update' (all orgs for skill), 'org_context' (all skills for org)
  job_type TEXT NOT NULL CHECK (job_type IN ('skill_update', 'org_context', 'manual')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INT NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Retry handling
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata for debugging
  triggered_by TEXT,  -- 'trigger', 'api', 'cron'
  metadata JSONB DEFAULT '{}'
);

-- Add comments for documentation
COMMENT ON TABLE platform_skills_refresh_queue IS 'Queue for tracking pending skill compilation jobs';
COMMENT ON COLUMN platform_skills_refresh_queue.job_type IS 'Type of refresh: skill_update (recompile skill for all orgs), org_context (recompile all skills for org), manual (explicit request)';
COMMENT ON COLUMN platform_skills_refresh_queue.priority IS 'Job priority 1-10 (1 = highest)';
COMMENT ON COLUMN platform_skills_refresh_queue.triggered_by IS 'What triggered this job: trigger, api, cron';

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_refresh_queue_pending ON platform_skills_refresh_queue(status, priority, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_refresh_queue_skill ON platform_skills_refresh_queue(skill_key)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_refresh_queue_org ON platform_skills_refresh_queue(organization_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_refresh_queue_cleanup ON platform_skills_refresh_queue(completed_at)
  WHERE status IN ('completed', 'failed');

-- =============================================================================
-- RLS Policies for platform_skills_refresh_queue
-- =============================================================================

ALTER TABLE platform_skills_refresh_queue ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all queue items
CREATE POLICY "Platform admins can view refresh queue"
  ON platform_skills_refresh_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Platform admins can manage queue items
CREATE POLICY "Platform admins can manage refresh queue"
  ON platform_skills_refresh_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =============================================================================
-- Enhanced Trigger: Queue recompilation jobs on platform skill update
-- Replaces the simple notify_platform_skill_update trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION queue_skill_refresh_on_update()
RETURNS TRIGGER AS $$
DECLARE
  affected_orgs INT;
BEGIN
  -- Only queue if content or frontmatter actually changed
  IF OLD.content_template IS NOT DISTINCT FROM NEW.content_template
     AND OLD.frontmatter IS NOT DISTINCT FROM NEW.frontmatter THEN
    RETURN NEW;
  END IF;

  -- Count affected organizations
  SELECT COUNT(*) INTO affected_orgs
  FROM organization_skills
  WHERE platform_skill_id = NEW.id
    AND is_active = true;

  -- Insert a single job for this skill update (batch processing)
  -- The refresh function will handle all orgs
  INSERT INTO platform_skills_refresh_queue (
    skill_key,
    organization_id,
    job_type,
    priority,
    triggered_by,
    metadata
  ) VALUES (
    NEW.skill_key,
    NULL,  -- NULL means all organizations
    'skill_update',
    3,  -- Higher priority for platform skill updates
    'trigger',
    jsonb_build_object(
      'old_version', OLD.version,
      'new_version', NEW.version,
      'affected_orgs', affected_orgs,
      'changed_at', now()
    )
  )
  ON CONFLICT DO NOTHING;  -- Avoid duplicate pending jobs

  -- Also mark individual org skills for recompile (fallback for direct queries)
  UPDATE organization_skills
  SET last_compiled_at = NULL
  WHERE platform_skill_id = NEW.id
    AND is_active = true;

  -- Log the update for monitoring
  RAISE NOTICE 'Platform skill % updated (v% -> v%), % orgs queued for recompile',
    NEW.skill_key, OLD.version, NEW.version, affected_orgs;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the old trigger with the new one
DROP TRIGGER IF EXISTS platform_skill_updated_trigger ON platform_skills;
DROP TRIGGER IF EXISTS queue_skill_refresh_trigger ON platform_skills;

CREATE TRIGGER queue_skill_refresh_trigger
  AFTER UPDATE ON platform_skills
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION queue_skill_refresh_on_update();

-- =============================================================================
-- Function: Process next queue item
-- Used by the refresh edge function or cron job
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_next_refresh_job()
RETURNS TABLE (
  job_id UUID,
  skill_key TEXT,
  organization_id UUID,
  job_type TEXT,
  metadata JSONB
) AS $$
DECLARE
  claimed_job RECORD;
BEGIN
  -- Atomically claim the next pending job
  UPDATE platform_skills_refresh_queue
  SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM platform_skills_refresh_queue
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id,
    platform_skills_refresh_queue.skill_key,
    platform_skills_refresh_queue.organization_id,
    platform_skills_refresh_queue.job_type,
    platform_skills_refresh_queue.metadata
  INTO claimed_job;

  IF claimed_job.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    claimed_job.id,
    claimed_job.skill_key,
    claimed_job.organization_id,
    claimed_job.job_type,
    claimed_job.metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION claim_next_refresh_job IS 'Atomically claim the next pending refresh job for processing';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_next_refresh_job TO authenticated;

-- =============================================================================
-- Function: Complete a refresh job
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_refresh_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE platform_skills_refresh_queue
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    completed_at = now(),
    last_error = p_error
  WHERE id = p_job_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_refresh_job IS 'Mark a refresh job as completed or failed';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_refresh_job TO authenticated;

-- =============================================================================
-- Function: Queue refresh for organization context update
-- Called when organization context changes
-- =============================================================================

CREATE OR REPLACE FUNCTION queue_org_context_refresh()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue a refresh job for this organization
  INSERT INTO platform_skills_refresh_queue (
    skill_key,
    organization_id,
    job_type,
    priority,
    triggered_by,
    metadata
  ) VALUES (
    NULL,  -- NULL means all skills
    COALESCE(NEW.organization_id, OLD.organization_id),
    'org_context',
    5,  -- Normal priority
    'trigger',
    jsonb_build_object(
      'context_key', COALESCE(NEW.context_key, OLD.context_key),
      'action', TG_OP,
      'changed_at', now()
    )
  )
  -- Avoid duplicate pending jobs for the same org
  ON CONFLICT DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on organization_context changes
DROP TRIGGER IF EXISTS org_context_changed_trigger ON organization_context;
CREATE TRIGGER org_context_changed_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organization_context
  FOR EACH ROW
  EXECUTE FUNCTION queue_org_context_refresh();

-- =============================================================================
-- Function: Clean up old queue entries
-- Should be called periodically (e.g., daily cron)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_refresh_queue(
  p_completed_older_than INTERVAL DEFAULT '7 days',
  p_failed_older_than INTERVAL DEFAULT '30 days'
)
RETURNS TABLE (
  deleted_completed INT,
  deleted_failed INT
) AS $$
DECLARE
  v_deleted_completed INT;
  v_deleted_failed INT;
BEGIN
  -- Delete completed jobs older than threshold
  WITH deleted AS (
    DELETE FROM platform_skills_refresh_queue
    WHERE status = 'completed'
      AND completed_at < now() - p_completed_older_than
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_completed FROM deleted;

  -- Delete failed jobs older than threshold
  WITH deleted AS (
    DELETE FROM platform_skills_refresh_queue
    WHERE status = 'failed'
      AND completed_at < now() - p_failed_older_than
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_failed FROM deleted;

  RETURN QUERY SELECT v_deleted_completed, v_deleted_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_refresh_queue IS 'Clean up old completed and failed queue entries';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_refresh_queue TO authenticated;

-- =============================================================================
-- Function: Get queue statistics
-- For monitoring and admin UI
-- =============================================================================

CREATE OR REPLACE FUNCTION get_refresh_queue_stats()
RETURNS TABLE (
  pending_count INT,
  processing_count INT,
  completed_today INT,
  failed_today INT,
  avg_processing_time_ms NUMERIC,
  oldest_pending_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM platform_skills_refresh_queue WHERE status = 'pending'),
    (SELECT COUNT(*)::INT FROM platform_skills_refresh_queue WHERE status = 'processing'),
    (SELECT COUNT(*)::INT FROM platform_skills_refresh_queue
      WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    (SELECT COUNT(*)::INT FROM platform_skills_refresh_queue
      WHERE status = 'failed' AND completed_at >= CURRENT_DATE),
    (SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::NUMERIC
      FROM platform_skills_refresh_queue
      WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    (SELECT MIN(created_at) FROM platform_skills_refresh_queue WHERE status = 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_refresh_queue_stats IS 'Get statistics about the refresh queue for monitoring';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_refresh_queue_stats TO authenticated;

-- =============================================================================
-- Add unique constraint to prevent duplicate pending jobs
-- =============================================================================

-- Create a partial unique index to prevent duplicate pending jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_queue_unique_pending
ON platform_skills_refresh_queue (skill_key, organization_id, job_type)
WHERE status = 'pending';
