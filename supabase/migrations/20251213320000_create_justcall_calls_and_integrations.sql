-- =====================================================
-- JustCall Integration (Org-wide) + Calls
-- =====================================================
-- Purpose:
--  - Store org-wide JustCall integration config (OAuth or API key/secret)
--  - Ingest JustCall calls (audio) into a dedicated calls table
--  - Support transcript retry and org-wide semantic indexing (File Search)
--
-- Notes:
--  - Secrets are stored in a separate table with admin-only access.
--  - Calls are org-visible (team-wide) per product requirement.
-- =====================================================

-- ---------------------------------------------------------------------
-- Integration tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS justcall_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Webhook routing token (stable per-org)
  webhook_token TEXT NOT NULL UNIQUE,

  -- Non-secret metadata
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  connected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id)
);

CREATE INDEX IF NOT EXISTS idx_justcall_integrations_org_id
  ON justcall_integrations(org_id);

CREATE TRIGGER update_justcall_integrations_updated_at
  BEFORE UPDATE ON justcall_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Secrets table: admin-only
CREATE TABLE IF NOT EXISTS justcall_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES justcall_integrations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- OAuth secrets (optional)
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,

  -- API key auth (optional)
  api_key TEXT,
  api_secret TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- keep org_id aligned with parent
  CONSTRAINT justcall_integration_secrets_org_matches_parent
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_justcall_integration_secrets_org_id
  ON justcall_integration_secrets(org_id);

CREATE TRIGGER update_justcall_integration_secrets_updated_at
  BEFORE UPDATE ON justcall_integration_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Calls table
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  provider TEXT NOT NULL DEFAULT 'justcall',
  external_id TEXT NOT NULL,

  -- Basic metadata
  direction TEXT NOT NULL DEFAULT 'unknown' CHECK (direction IN ('inbound', 'outbound', 'internal', 'unknown')),
  status TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  from_number TEXT,
  to_number TEXT,

  -- JustCall agent mapping
  justcall_agent_id TEXT,
  agent_email TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email TEXT,

  -- Recording
  recording_url TEXT,
  recording_mime TEXT,
  has_recording BOOLEAN NOT NULL DEFAULT false,

  -- Transcript
  transcript_text TEXT,
  transcript_json JSONB,
  transcript_status TEXT NOT NULL DEFAULT 'missing' CHECK (transcript_status IN ('missing', 'queued', 'processing', 'ready', 'failed')),
  transcript_fetch_attempts INTEGER NOT NULL DEFAULT 0,
  last_transcript_fetch_at TIMESTAMPTZ,

  -- CRM linking (best-effort)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Optional AI fields
  summary TEXT,
  sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_reasoning TEXT,

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calls_org_id_started_at
  ON calls(org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_id_owner_user_id
  ON calls(org_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id_contact_id
  ON calls(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id_company_id
  ON calls(org_id, company_id);

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Transcript retry queue (async backoff)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS call_transcript_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,

  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_transcript_queue_priority
  ON call_transcript_queue(priority DESC, created_at ASC);

-- ---------------------------------------------------------------------
-- Semantic indexing (File Search) - parallel to meetings
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS call_file_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  file_name TEXT,
  content_hash TEXT,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(call_id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_file_search_index_org_id
  ON call_file_search_index(org_id);
CREATE INDEX IF NOT EXISTS idx_call_file_search_index_status
  ON call_file_search_index(status);

CREATE TABLE IF NOT EXISTS call_index_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_index_queue_priority
  ON call_index_queue(priority DESC, created_at ASC);

-- Auto-queue calls when transcript becomes available (similar to meetings)
CREATE OR REPLACE FUNCTION queue_call_for_indexing()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.transcript_text IS NULL OR OLD.transcript_text = '')
     AND (NEW.transcript_text IS NOT NULL AND NEW.transcript_text != '')
     AND LENGTH(NEW.transcript_text) > 100 THEN
    INSERT INTO call_index_queue (call_id, org_id, owner_user_id, priority)
    VALUES (NEW.id, NEW.org_id, NEW.owner_user_id, 0)
    ON CONFLICT (call_id) DO UPDATE SET
      attempts = 0,
      error_message = NULL,
      created_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_queue_call_index ON calls;
CREATE TRIGGER trigger_queue_call_index
  AFTER UPDATE ON calls
  FOR EACH ROW
  WHEN (OLD.transcript_text IS DISTINCT FROM NEW.transcript_text)
  EXECUTE FUNCTION queue_call_for_indexing();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

ALTER TABLE justcall_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE justcall_integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcript_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_file_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_index_queue ENABLE ROW LEVEL SECURITY;

-- justcall_integrations: org members can read; org admins manage; service role manage.
DROP POLICY IF EXISTS "org_select_justcall_integrations" ON justcall_integrations;
CREATE POLICY "org_select_justcall_integrations"
  ON justcall_integrations FOR SELECT
  USING (can_access_org_data(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_admins_manage_justcall_integrations" ON justcall_integrations;
CREATE POLICY "org_admins_manage_justcall_integrations"
  ON justcall_integrations FOR ALL
  USING (can_admin_org(org_id) OR public.is_service_role())
  WITH CHECK (can_admin_org(org_id) OR public.is_service_role());

-- secrets: only org admins (and service role)
DROP POLICY IF EXISTS "org_admins_manage_justcall_integration_secrets" ON justcall_integration_secrets;
CREATE POLICY "org_admins_manage_justcall_integration_secrets"
  ON justcall_integration_secrets FOR ALL
  USING (can_admin_org(org_id) OR public.is_service_role())
  WITH CHECK (can_admin_org(org_id) OR public.is_service_role());

-- calls: team-wide read/write within org (members can write; admins not required)
DROP POLICY IF EXISTS "org_select_calls" ON calls;
CREATE POLICY "org_select_calls"
  ON calls FOR SELECT
  USING (can_access_org_data(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_insert_calls" ON calls;
CREATE POLICY "org_insert_calls"
  ON calls FOR INSERT
  WITH CHECK (can_write_to_org(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_update_calls" ON calls;
CREATE POLICY "org_update_calls"
  ON calls FOR UPDATE
  USING (can_access_org_data(org_id) OR public.is_service_role())
  WITH CHECK (can_write_to_org(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_delete_calls" ON calls;
CREATE POLICY "org_delete_calls"
  ON calls FOR DELETE
  USING (can_write_to_org(org_id) OR public.is_service_role());

-- Internal queues/index: service role only (avoid client tampering)
DROP POLICY IF EXISTS "service_role_manage_call_transcript_queue" ON call_transcript_queue;
CREATE POLICY "service_role_manage_call_transcript_queue"
  ON call_transcript_queue FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "service_role_manage_call_index_queue" ON call_index_queue;
CREATE POLICY "service_role_manage_call_index_queue"
  ON call_index_queue FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "service_role_manage_call_file_search_index" ON call_file_search_index;
CREATE POLICY "service_role_manage_call_file_search_index"
  ON call_file_search_index FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- Helpful comments
COMMENT ON TABLE justcall_integrations IS 'Org-wide JustCall integration configuration (non-secret fields)';
COMMENT ON TABLE justcall_integration_secrets IS 'Org-wide JustCall integration secrets (admin-only)';
COMMENT ON TABLE calls IS 'Audio calls imported from dialers (JustCall initially)';
COMMENT ON TABLE call_transcript_queue IS 'Async retry queue for fetching call transcripts';
COMMENT ON TABLE call_index_queue IS 'Async queue for indexing call transcripts into File Search';
COMMENT ON TABLE call_file_search_index IS 'Index tracking for calls indexed into File Search';








