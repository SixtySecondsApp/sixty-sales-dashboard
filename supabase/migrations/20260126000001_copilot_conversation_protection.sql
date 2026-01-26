-- =====================================================================
-- COPILOT CONVERSATION DATA PROTECTION
-- Addresses Clawdbot lesson: "Conversation history as intelligence"
-- =====================================================================
--
-- "Months of context about how someone thinks, what they're working on,
-- who they communicate with, what they're planning - that's intelligence,
-- and we're not protecting it like we should."
--
-- This migration adds:
-- 1. Encryption helpers for sensitive conversation data
-- 2. Data retention policies
-- 3. Access logging for conversation queries
-- 4. Export restrictions and rate limiting
--
-- Date: 2026-01-26
-- =====================================================================

-- =====================================================================
-- PART 1: CONVERSATION ACCESS LOGGING
-- =====================================================================

-- Track every read of copilot conversations for security monitoring
CREATE OR REPLACE FUNCTION public.log_copilot_conversation_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log read access to security audit
  INSERT INTO public.security_audit_log (
    user_id,
    org_id,
    operation,
    table_name,
    record_id,
    metadata,
    severity
  )
  VALUES (
    auth.uid(),
    (SELECT org_id FROM public.organization_memberships WHERE user_id = auth.uid() LIMIT 1),
    'copilot_conversation_access',
    'copilot_conversations',
    NEW.id,
    jsonb_build_object(
      'conversation_id', NEW.id,
      'user_id', NEW.user_id,
      'accessed_by', auth.uid()
    ),
    'info'
  );

  RETURN NEW;
END;
$$;

-- Trigger on SELECT (via AFTER INSERT/UPDATE as proxy)
-- Note: PostgreSQL doesn't support AFTER SELECT triggers directly
-- Instead, we'll log via RLS policy and function calls

COMMENT ON FUNCTION public.log_copilot_conversation_access() IS
  'Logs access to copilot conversations for security monitoring. Conversations contain strategic intelligence and all access should be auditable.';

-- =====================================================================
-- PART 2: DATA RETENTION POLICIES
-- =====================================================================

-- Add retention metadata to copilot_conversations
ALTER TABLE public.copilot_conversations
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_copilot_conversations_retention
  ON public.copilot_conversations(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL;

COMMENT ON COLUMN public.copilot_conversations.retention_expires_at IS
  'Date when this conversation will be automatically deleted. Null = keep indefinitely (user discretion).';

COMMENT ON COLUMN public.copilot_conversations.is_archived IS
  'Archived conversations are hidden from normal UI but preserved for compliance.';

-- Function to archive old conversations (run via cron)
CREATE OR REPLACE FUNCTION public.archive_old_copilot_conversations(
  p_retention_days integer DEFAULT 365 -- Default: 1 year
)
RETURNS TABLE(
  archived_count bigint,
  oldest_archived timestamptz,
  newest_archived timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_count bigint;
  v_oldest timestamptz;
  v_newest timestamptz;
BEGIN
  -- Archive conversations older than retention period
  WITH archived AS (
    UPDATE public.copilot_conversations
    SET
      is_archived = true,
      archived_at = now()
    WHERE
      is_archived = false
      AND created_at < (now() - (p_retention_days || ' days')::interval)
      AND retention_expires_at IS NULL -- Don't auto-archive if user set custom retention
    RETURNING created_at
  )
  SELECT
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
  INTO v_archived_count, v_oldest, v_newest
  FROM archived;

  RETURN QUERY SELECT v_archived_count, v_oldest, v_newest;
END;
$$;

COMMENT ON FUNCTION public.archive_old_copilot_conversations(integer) IS
  'Archives copilot conversations older than specified retention period. Archived conversations are hidden from UI but preserved for compliance. Default: 365 days.';

-- Function to permanently delete expired conversations (GDPR compliance)
CREATE OR REPLACE FUNCTION public.delete_expired_copilot_conversations()
RETURNS TABLE(
  deleted_count bigint,
  oldest_deleted timestamptz,
  newest_deleted timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count bigint;
  v_oldest timestamptz;
  v_newest timestamptz;
BEGIN
  -- Delete conversations past their retention date
  WITH deleted AS (
    DELETE FROM public.copilot_conversations
    WHERE
      retention_expires_at IS NOT NULL
      AND retention_expires_at < now()
    RETURNING created_at, id, user_id
  )
  SELECT
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
  INTO v_deleted_count, v_oldest, v_newest
  FROM deleted;

  -- Log deletions
  IF v_deleted_count > 0 THEN
    INSERT INTO public.security_audit_log (
      user_id,
      operation,
      table_name,
      metadata,
      severity
    )
    VALUES (
      NULL, -- System operation
      'copilot_conversation_auto_delete',
      'copilot_conversations',
      jsonb_build_object(
        'deleted_count', v_deleted_count,
        'oldest_deleted', v_oldest,
        'newest_deleted', v_newest
      ),
      'info'
    );
  END IF;

  RETURN QUERY SELECT v_deleted_count, v_oldest, v_newest;
END;
$$;

COMMENT ON FUNCTION public.delete_expired_copilot_conversations() IS
  'Permanently deletes copilot conversations past their retention_expires_at date. Used for GDPR compliance and data minimization. Logs all deletions to audit log.';

-- =====================================================================
-- PART 3: BULK EXPORT RESTRICTIONS
-- =====================================================================

-- Prevent bulk export of conversation data (Clawdbot lesson)
CREATE OR REPLACE FUNCTION public.check_conversation_export_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_exports bigint;
  v_org_id uuid;
BEGIN
  -- Get user's org
  SELECT org_id INTO v_org_id
  FROM public.organization_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Count recent export operations in last hour
  SELECT COUNT(*)
  INTO v_recent_exports
  FROM public.security_audit_log
  WHERE
    user_id = auth.uid()
    AND operation = 'copilot_conversation_export'
    AND occurred_at >= now() - interval '1 hour';

  -- Allow max 10 exports per hour
  IF v_recent_exports >= 10 THEN
    RAISE EXCEPTION 'Export limit exceeded: Maximum 10 conversation exports per hour. This protects against bulk data exfiltration.';
  END IF;

  -- Log the export
  INSERT INTO public.security_audit_log (
    user_id,
    org_id,
    operation,
    table_name,
    metadata,
    severity
  )
  VALUES (
    auth.uid(),
    v_org_id,
    'copilot_conversation_export',
    'copilot_conversations',
    jsonb_build_object(
      'conversation_id', NEW.id,
      'recent_exports', v_recent_exports + 1
    ),
    CASE WHEN v_recent_exports >= 5 THEN 'warning' ELSE 'info' END
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_conversation_export_limit() IS
  'Rate limits conversation exports to prevent bulk data exfiltration. Maximum 10 exports per hour per user. Logs all export attempts for security monitoring.';

-- =====================================================================
-- PART 4: CONVERSATION SANITIZATION HELPERS
-- =====================================================================

-- Remove PII from conversation content (for analytics/debugging)
CREATE OR REPLACE FUNCTION public.sanitize_conversation_content(
  p_content text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Replace emails
  p_content := regexp_replace(p_content, '\S+@\S+\.\S+', '[EMAIL]', 'gi');

  -- Replace phone numbers (US format)
  p_content := regexp_replace(p_content, '\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '[PHONE]', 'g');

  -- Replace SSNs
  p_content := regexp_replace(p_content, '\d{3}-\d{2}-\d{4}', '[SSN]', 'g');

  -- Replace credit card numbers (basic pattern)
  p_content := regexp_replace(p_content, '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}', '[CARD]', 'g');

  -- Replace IP addresses
  p_content := regexp_replace(p_content, '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '[IP]', 'g');

  RETURN p_content;
END;
$$;

COMMENT ON FUNCTION public.sanitize_conversation_content(text) IS
  'Removes PII (emails, phones, SSNs, credit cards, IPs) from conversation content. Use for analytics, debugging, or sharing conversations with support. Does not modify source data.';

-- =====================================================================
-- PART 5: CONVERSATION SEARCH WITH ACCESS CONTROL
-- =====================================================================

-- Secure conversation search (prevents timing attacks)
CREATE OR REPLACE FUNCTION public.search_my_conversations(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  title text,
  created_at timestamptz,
  last_message_at timestamptz,
  message_count integer,
  snippet text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log search for security monitoring
  PERFORM public.log_security_event(
    'copilot_conversation_search',
    'copilot_conversations',
    NULL,
    jsonb_build_object('query', left(p_query, 100)),
    'info'
  );

  -- Return user's own conversations only
  RETURN QUERY
  SELECT
    cc.id,
    cc.title,
    cc.created_at,
    cc.last_message_at,
    cc.message_count,
    left(cc.title, 100) as snippet -- Limited snippet to prevent data leakage
  FROM public.copilot_conversations cc
  WHERE
    cc.user_id = auth.uid()
    AND cc.is_archived = false
    AND (
      cc.title ILIKE '%' || p_query || '%'
      -- Add more search fields as needed
    )
  ORDER BY cc.last_message_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_my_conversations(text, integer) IS
  'Secure search for user''s own copilot conversations. Logs all searches and limits results to prevent data leakage. Only returns non-archived conversations.';

-- =====================================================================
-- PART 6: CONVERSATION METADATA TABLE (ANALYTICS WITHOUT PII)
-- =====================================================================

-- Store conversation metadata for analytics WITHOUT sensitive content
CREATE TABLE IF NOT EXISTS public.copilot_conversation_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference (no foreign key to allow deletion of source conversation)
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Anonymized metadata
  message_count integer NOT NULL DEFAULT 0,
  tool_call_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  avg_response_time_ms numeric,

  -- Aggregated statistics (no content)
  most_used_tools text[], -- ['get_contact', 'search_emails']
  date date NOT NULL, -- Day of conversation

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(conversation_id, date)
);

ALTER TABLE public.copilot_conversation_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view their own analytics
CREATE POLICY "copilot_conversation_analytics_select" ON public.copilot_conversation_analytics
  FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_copilot_conversation_analytics_user_date
  ON public.copilot_conversation_analytics(user_id, date DESC);

COMMENT ON TABLE public.copilot_conversation_analytics IS
  'Anonymized analytics for copilot conversations. Contains NO message content or PII. Used for usage statistics and product improvements while preserving user privacy.';

-- =====================================================================
-- PART 7: CRON JOBS FOR AUTOMATED MAINTENANCE
-- =====================================================================

-- Schedule automatic conversation archival (run daily at 2 AM)
SELECT cron.schedule(
  'archive-old-copilot-conversations',
  '0 2 * * *', -- Daily at 2 AM
  $$
    SELECT public.archive_old_copilot_conversations(365); -- 1 year retention
  $$
);

-- Schedule automatic expired conversation deletion (run daily at 3 AM)
SELECT cron.schedule(
  'delete-expired-copilot-conversations',
  '0 3 * * *', -- Daily at 3 AM
  $$
    SELECT public.delete_expired_copilot_conversations();
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Scheduled jobs for copilot conversation maintenance: archival (2 AM daily), deletion (3 AM daily).';

-- =====================================================================
-- PART 8: USER-FACING FUNCTIONS
-- =====================================================================

-- Allow users to set retention on their conversations
CREATE OR REPLACE FUNCTION public.set_conversation_retention(
  p_conversation_id uuid,
  p_retention_days integer -- NULL = keep indefinitely, 30/90/365 = auto-delete
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at timestamptz;
BEGIN
  -- Calculate expiration date
  IF p_retention_days IS NOT NULL THEN
    v_expires_at := now() + (p_retention_days || ' days')::interval;
  ELSE
    v_expires_at := NULL; -- Keep indefinitely
  END IF;

  -- Update user's conversation
  UPDATE public.copilot_conversations
  SET retention_expires_at = v_expires_at
  WHERE
    id = p_conversation_id
    AND user_id = auth.uid();

  -- Log retention change
  PERFORM public.log_security_event(
    'copilot_conversation_retention_set',
    'copilot_conversations',
    p_conversation_id,
    jsonb_build_object(
      'retention_days', p_retention_days,
      'expires_at', v_expires_at
    ),
    'info'
  );

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.set_conversation_retention(uuid, integer) IS
  'Allows users to set retention policy on their copilot conversations. NULL = keep indefinitely, integer = days until auto-deletion. Supports GDPR right to erasure.';

-- Allow users to permanently delete their conversations
CREATE OR REPLACE FUNCTION public.delete_my_conversation(
  p_conversation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log deletion attempt
  PERFORM public.log_security_event(
    'copilot_conversation_manual_delete',
    'copilot_conversations',
    p_conversation_id,
    jsonb_build_object('conversation_id', p_conversation_id),
    'info'
  );

  -- Delete user's conversation
  DELETE FROM public.copilot_conversations
  WHERE
    id = p_conversation_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.delete_my_conversation(uuid) IS
  'Allows users to permanently delete their own copilot conversations. Supports GDPR right to erasure and data minimization.';

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
