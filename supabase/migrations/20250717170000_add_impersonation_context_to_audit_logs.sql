-- Add impersonation context tracking to audit logs for security and compliance
-- This migration adds fields to track when admin users impersonate other users

-- Add impersonation context fields to audit_logs table
ALTER TABLE audit_logs 
ADD COLUMN original_user_id UUID REFERENCES auth.users(id),
ADD COLUMN impersonated_user_id UUID REFERENCES auth.users(id),
ADD COLUMN is_impersonation BOOLEAN DEFAULT FALSE NOT NULL;

-- Create indexes for efficient impersonation-based queries
CREATE INDEX audit_logs_original_user_id_idx ON audit_logs(original_user_id);
CREATE INDEX audit_logs_impersonated_user_id_idx ON audit_logs(impersonated_user_id);
CREATE INDEX audit_logs_is_impersonation_idx ON audit_logs(is_impersonation);

-- Create composite index for impersonation tracking
CREATE INDEX audit_logs_impersonation_context_idx ON audit_logs(original_user_id, impersonated_user_id, is_impersonation);

-- Update the audit trigger function to capture impersonation context
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
  current_session_id TEXT;
  current_user_id UUID;
  original_user_id UUID;
  impersonated_user_id UUID;
  is_impersonation BOOLEAN := FALSE;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
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
  IF current_session_id IS NULL AND current_user_id IS NOT NULL THEN
    current_session_id := 'auto_' || current_user_id::text || '_' || extract(epoch from now())::text;
  END IF;

  -- Try to get impersonation context from app settings
  BEGIN
    -- Check if we have impersonation context set
    original_user_id := current_setting('app.original_user_id', true)::UUID;
    impersonated_user_id := current_setting('app.impersonated_user_id', true)::UUID;
    is_impersonation := current_setting('app.is_impersonating', true)::BOOLEAN;
    
    -- If settings are empty strings, treat as NULL
    IF original_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
      original_user_id := NULL;
    END IF;
    IF impersonated_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
      impersonated_user_id := NULL;
    END IF;
    
    -- If we have both original and impersonated user IDs, this is impersonation
    IF original_user_id IS NOT NULL AND impersonated_user_id IS NOT NULL THEN
      is_impersonation := TRUE;
    ELSE
      is_impersonation := FALSE;
      original_user_id := NULL;
      impersonated_user_id := NULL;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If we can't get impersonation context, default to no impersonation
      original_user_id := NULL;
      impersonated_user_id := NULL;
      is_impersonation := FALSE;
  END;

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
      original_user_id,
      impersonated_user_id,
      is_impersonation,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      current_user_id,
      current_session_id,
      original_user_id,
      impersonated_user_id,
      is_impersonation,
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
        original_user_id,
        impersonated_user_id,
        is_impersonation,
        old_data,
        new_data,
        changed_fields
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        current_user_id,
        current_session_id,
        original_user_id,
        impersonated_user_id,
        is_impersonation,
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
      original_user_id,
      impersonated_user_id,
      is_impersonation,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      current_user_id,
      current_session_id,
      original_user_id,
      impersonated_user_id,
      is_impersonation,
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_audit_history function to include impersonation fields
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
  session_id TEXT,
  original_user_id UUID,
  impersonated_user_id UUID,
  is_impersonation BOOLEAN
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
    audit_logs.session_id,
    audit_logs.original_user_id,
    audit_logs.impersonated_user_id,
    audit_logs.is_impersonation
  FROM audit_logs
  WHERE table_name = p_table_name
    AND record_id = p_record_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_field_history function to include impersonation fields
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
  session_id TEXT,
  original_user_id UUID,
  impersonated_user_id UUID,
  is_impersonation BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    audit_logs.changed_at,
    old_data->>p_field_name as old_value,
    new_data->>p_field_name as new_value,
    user_id as changed_by,
    audit_logs.session_id,
    audit_logs.original_user_id,
    audit_logs.impersonated_user_id,
    audit_logs.is_impersonation
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

-- Update the get_audit_logs_by_session function to include impersonation fields
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
  new_value JSONB,
  original_user_id UUID,
  impersonated_user_id UUID,
  is_impersonation BOOLEAN
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
    new_data as new_value,
    audit_logs.original_user_id,
    audit_logs.impersonated_user_id,
    audit_logs.is_impersonation
  FROM audit_logs
  WHERE session_id = p_session_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new function to get impersonation-specific audit logs
CREATE OR REPLACE FUNCTION get_impersonation_audit_logs(
  p_original_user_id UUID DEFAULT NULL,
  p_impersonated_user_id UUID DEFAULT NULL,
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
  new_value JSONB,
  session_id TEXT,
  original_user_id UUID,
  impersonated_user_id UUID
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
    new_data as new_value,
    audit_logs.session_id,
    audit_logs.original_user_id,
    audit_logs.impersonated_user_id
  FROM audit_logs
  WHERE is_impersonation = TRUE
    AND (p_original_user_id IS NULL OR audit_logs.original_user_id = p_original_user_id)
    AND (p_impersonated_user_id IS NULL OR audit_logs.impersonated_user_id = p_impersonated_user_id)
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get impersonation session summary
CREATE OR REPLACE FUNCTION get_impersonation_session_summary(
  p_original_user_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  original_user_id UUID,
  impersonated_user_id UUID,
  session_id TEXT,
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
    audit_logs.original_user_id,
    audit_logs.impersonated_user_id,
    audit_logs.session_id,
    MIN(audit_logs.changed_at) as first_activity,
    MAX(audit_logs.changed_at) as last_activity,
    COUNT(*)::INTEGER as total_actions,
    ARRAY_AGG(DISTINCT audit_logs.table_name) as tables_affected,
    COUNT(CASE WHEN action = 'INSERT' THEN 1 END)::INTEGER as insert_count,
    COUNT(CASE WHEN action = 'UPDATE' THEN 1 END)::INTEGER as update_count,
    COUNT(CASE WHEN action = 'DELETE' THEN 1 END)::INTEGER as delete_count
  FROM audit_logs
  WHERE is_impersonation = TRUE
    AND (p_original_user_id IS NULL OR audit_logs.original_user_id = p_original_user_id)
    AND (p_start_date IS NULL OR audit_logs.changed_at >= p_start_date)
    AND (p_end_date IS NULL OR audit_logs.changed_at <= p_end_date)
  GROUP BY audit_logs.original_user_id, audit_logs.impersonated_user_id, audit_logs.session_id
  ORDER BY first_activity DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_impersonation_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_impersonation_session_summary TO authenticated;

-- Add comments to document the impersonation fields
COMMENT ON COLUMN audit_logs.original_user_id IS 'The original admin user ID who initiated impersonation. NULL if not an impersonation action.';
COMMENT ON COLUMN audit_logs.impersonated_user_id IS 'The user ID being impersonated. NULL if not an impersonation action.';
COMMENT ON COLUMN audit_logs.is_impersonation IS 'Boolean flag indicating if this action was performed during user impersonation.';