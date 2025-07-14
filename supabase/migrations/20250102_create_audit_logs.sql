-- Create audit log table to track all changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[], -- Array of field names that changed
  ip_address INET,
  user_agent TEXT,
  
  -- Indexes for performance
  CONSTRAINT audit_logs_table_record_idx UNIQUE (table_name, record_id, changed_at)
);

-- Create indexes for efficient querying
CREATE INDEX audit_logs_table_name_idx ON audit_logs(table_name);
CREATE INDEX audit_logs_record_id_idx ON audit_logs(record_id);
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_changed_at_idx ON audit_logs(changed_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Function to get changed fields between old and new data
CREATE OR REPLACE FUNCTION get_changed_fields(old_data JSONB, new_data JSONB)
RETURNS TEXT[] AS $$
DECLARE
  changed_fields TEXT[] := '{}';
  key TEXT;
BEGIN
  -- Check fields that exist in new data
  FOR key IN SELECT jsonb_object_keys(new_data)
  LOOP
    IF old_data IS NULL OR 
       NOT old_data ? key OR 
       old_data->key IS DISTINCT FROM new_data->key THEN
      changed_fields := array_append(changed_fields, key);
    END IF;
  END LOOP;
  
  -- Check fields that were removed (exist in old but not in new)
  IF old_data IS NOT NULL THEN
    FOR key IN SELECT jsonb_object_keys(old_data)
    LOOP
      IF NOT new_data ? key THEN
        changed_fields := array_append(changed_fields, key);
      END IF;
    END LOOP;
  END IF;
  
  RETURN changed_fields;
END;
$$ LANGUAGE plpgsql;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
BEGIN
  -- Set the user_id from auth context
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    new_data := NULL;
    
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      user_id,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      auth.uid(),
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
        old_data,
        new_data,
        changed_fields
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        auth.uid(),
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
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      auth.uid(),
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables

-- Activities table (most important for tracking meeting type changes)
DROP TRIGGER IF EXISTS audit_activities_trigger ON activities;
CREATE TRIGGER audit_activities_trigger
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Deals table
DROP TRIGGER IF EXISTS audit_deals_trigger ON deals;
CREATE TRIGGER audit_deals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Contacts table
DROP TRIGGER IF EXISTS audit_contacts_trigger ON contacts;
CREATE TRIGGER audit_contacts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Companies table
DROP TRIGGER IF EXISTS audit_companies_trigger ON companies;
CREATE TRIGGER audit_companies_trigger
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Tasks table
DROP TRIGGER IF EXISTS audit_tasks_trigger ON tasks;
CREATE TRIGGER audit_tasks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Function to query audit history for a specific record
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
  new_value JSONB
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
    new_data as new_value
  FROM audit_logs
  WHERE table_name = p_table_name
    AND record_id = p_record_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get specific field history
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
  changed_by UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    audit_logs.changed_at,
    old_data->>p_field_name as old_value,
    new_data->>p_field_name as new_value,
    user_id as changed_by
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_audit_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_field_history TO authenticated;

-- Add comment
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all data changes. Tracks who changed what, when, and the before/after values.';