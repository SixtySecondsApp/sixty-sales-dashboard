-- ============================================================================
-- Next Action Suggestions: Resolve user_id for Calls
-- ============================================================================
-- Purpose:
--  - Ensure next_action_suggestions.user_id can be auto-derived for activity_type='call'
--    so suggestions can be inserted with user_id NULL by edge functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_id_from_activity(
  p_activity_id UUID,
  p_activity_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  CASE p_activity_type
    WHEN 'meeting' THEN
      SELECT owner_user_id INTO v_user_id
      FROM meetings
      WHERE id = p_activity_id;

    WHEN 'call' THEN
      SELECT owner_user_id INTO v_user_id
      FROM calls
      WHERE id = p_activity_id;

    WHEN 'activity' THEN
      SELECT user_id INTO v_user_id
      FROM activities
      WHERE id = p_activity_id;

    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_id_from_activity(UUID, TEXT) TO service_role;

