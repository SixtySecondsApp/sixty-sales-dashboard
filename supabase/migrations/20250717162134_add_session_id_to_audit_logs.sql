-- Add session_id field to audit_logs table for better security context and compliance
-- This helps track user sessions across different actions and identify potential security issues

-- Add session_id column to audit_logs table
ALTER TABLE audit_logs 
ADD COLUMN session_id TEXT;

-- Create index for efficient session-based queries
CREATE INDEX audit_logs_session_id_idx ON audit_logs(session_id);

-- Create composite index for user_id and session_id for user session tracking
CREATE INDEX audit_logs_user_session_idx ON audit_logs(user_id, session_id);

-- Update the audit trigger function to capture session information
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
  current_session_id TEXT;
BEGIN
  -- Try to get session ID from various sources
  -- First try to get from current_setting if available
  BEGIN
    current_session_id := current_setting('app.session_id', true);
    IF current_session_id = '' THEN
      current_session_id := NULL;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      current_session_id := NULL;
  END;
  
  -- If not available, try to get from auth context (this will work with Supabase auth)
  IF current_session_id IS NULL THEN
    BEGIN
      -- Get session ID from auth.jwt() if available
      SELECT COALESCE(
        auth.jwt() ->> 'session_id',
        auth.jwt() ->> 'sub'  -- Use user ID as fallback
      ) INTO current_session_id;
    EXCEPTION
      WHEN OTHERS THEN
        current_session_id := NULL;
    END;
  END IF;
  
  -- If still no session ID, generate one based on user and timestamp
  IF current_session_id IS NULL AND auth.uid() IS NOT NULL THEN
    current_session_id := 'auto_' || auth.uid()::text || '_' || extract(epoch from now())::text;
  END IF;

  -- Set the user_id from auth context
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    new_data := NULL;
    
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      user_id,
      session_id,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      auth.uid(),
      current_session_id,
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );
    
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    changed_fields := get_changed_fields(old_data, new_data);
    
    -- Only log if there were actual changes
    IF array_length(changed_fields, 1) > 0 THEN
      INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        user_id,
        session_id,
        old_data,
        new_data,
        changed_fields
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        auth.uid(),
        current_session_id,
        old_data,
        new_data,
        changed_fields
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    old_data := NULL;
    new_data := to_jsonb(NEW);
    
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      user_id,
      session_id,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      auth.uid(),
      current_session_id,
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_audit_history function to include session_id
CREATE OR REPLACE FUNCTION get_audit_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  audit_id UUID,
  action TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_fields TEXT[],
  old_value JSONB,
  new_value JSONB,
  session_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id as audit_id,
    audit_logs.action,
    user_id as changed_by,
    audit_logs.changed_at,
    audit_logs.changed_fields,
    old_data as old_value,
    new_data as new_value,
    audit_logs.session_id
  FROM audit_logs
  WHERE table_name = p_table_name
    AND record_id = p_record_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_field_history function to include session_id
CREATE OR REPLACE FUNCTION get_field_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  changed_at TIMESTAMP WITH TIME ZONE,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  session_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    audit_logs.changed_at,
    old_data->>p_field_name as old_value,
    new_data->>p_field_name as new_value,
    user_id as changed_by,
    audit_logs.session_id
  FROM audit_logs
  WHERE table_name = p_table_name
    AND record_id = p_record_id
    AND (
      p_field_name = ANY(changed_fields)
      OR action IN ('INSERT', 'DELETE')
    )
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new function to get audit logs by session
CREATE OR REPLACE FUNCTION get_audit_logs_by_session(
  p_session_id TEXT,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  audit_id UUID,
  table_name TEXT,
  record_id UUID,
  action TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_fields TEXT[],
  old_value JSONB,
  new_value JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id as audit_id,
    audit_logs.table_name,
    audit_logs.record_id,
    audit_logs.action,
    user_id as changed_by,
    audit_logs.changed_at,
    audit_logs.changed_fields,
    old_data as old_value,
    new_data as new_value
  FROM audit_logs
  WHERE session_id = p_session_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get session activity summary
CREATE OR REPLACE FUNCTION get_session_activity_summary(
  p_session_id TEXT
)
RETURNS TABLE (
  session_id TEXT,
  user_id UUID,
  first_activity TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  total_actions INTEGER,
  tables_affected TEXT[],
  insert_count INTEGER,
  update_count INTEGER,
  delete_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_session_id as session_id,
    audit_logs.user_id,
    MIN(audit_logs.changed_at) as first_activity,
    MAX(audit_logs.changed_at) as last_activity,
    COUNT(*)::INTEGER as total_actions,
    ARRAY_AGG(DISTINCT audit_logs.table_name) as tables_affected,
    COUNT(CASE WHEN action = 'INSERT' THEN 1 END)::INTEGER as insert_count,
    COUNT(CASE WHEN action = 'UPDATE' THEN 1 END)::INTEGER as update_count,
    COUNT(CASE WHEN action = 'DELETE' THEN 1 END)::INTEGER as delete_count
  FROM audit_logs
  WHERE audit_logs.session_id = p_session_id
  GROUP BY audit_logs.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_audit_logs_by_session TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_activity_summary TO authenticated;

-- Add comment to document the session_id field
COMMENT ON COLUMN audit_logs.session_id IS 'Session identifier for tracking user sessions across different actions. Helps identify potential security issues and session-based audit trails.';