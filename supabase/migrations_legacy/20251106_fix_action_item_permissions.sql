-- Fix permission denied errors for action item triggers
-- The functions that query auth.users need SECURITY DEFINER

-- Function to check if email belongs to an internal user (sales rep)
CREATE OR REPLACE FUNCTION is_internal_assignee(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to access auth.users
STABLE
SET search_path = public, auth
AS $$
BEGIN
  -- Check if email matches a user in auth.users
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = email_input
  );
END;
$$;

-- Function to get user ID from email
CREATE OR REPLACE FUNCTION get_user_id_from_email(email_input TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to access auth.users
STABLE
SET search_path = public, auth
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = email_input
  LIMIT 1;

  RETURN user_uuid;
END;
$$;

-- Update sync_task_assignee_to_action_item to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_task_assignee_to_action_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to access auth.users
SET search_path = public, auth
AS $$
DECLARE
  new_assignee_email TEXT;
  new_assignee_name TEXT;
BEGIN
  -- Only sync if linked to action item
  IF NEW.meeting_action_item_id IS NOT NULL THEN
    -- Get new assignee details
    SELECT email, COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ) INTO new_assignee_email, new_assignee_name
    FROM auth.users
    WHERE id = NEW.assigned_to;

    -- Update action item with new assignee
    UPDATE meeting_action_items
    SET
      assignee_email = new_assignee_email,
      assignee_name = new_assignee_name,
      updated_at = NOW()
    WHERE id = NEW.meeting_action_item_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION is_internal_assignee(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_id_from_email(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_task_assignee_to_action_item() TO authenticated, service_role;

COMMENT ON FUNCTION is_internal_assignee(TEXT) IS 'Check if email belongs to an internal user (SECURITY DEFINER allows auth.users access)';
COMMENT ON FUNCTION get_user_id_from_email(TEXT) IS 'Get UUID for user by email address (SECURITY DEFINER allows auth.users access)';
COMMENT ON FUNCTION sync_task_assignee_to_action_item() IS 'Bidirectional sync: Update action item assignee when task assignee changes (SECURITY DEFINER allows auth.users access)';
