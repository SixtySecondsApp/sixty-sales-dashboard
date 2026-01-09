-- Add request metadata fields to audit_logs table for comprehensive audit trails
-- This captures HTTP method, endpoint, headers, response status, and timing information

-- Add new columns for request metadata
ALTER TABLE audit_logs 
ADD COLUMN request_method TEXT,
ADD COLUMN request_endpoint TEXT,
ADD COLUMN request_headers JSONB,
ADD COLUMN response_status INTEGER,
ADD COLUMN request_duration INTEGER; -- in milliseconds

-- Create indexes for efficient querying
CREATE INDEX audit_logs_request_method_idx ON audit_logs(request_method);
CREATE INDEX audit_logs_request_endpoint_idx ON audit_logs(request_endpoint);
CREATE INDEX audit_logs_response_status_idx ON audit_logs(response_status);
CREATE INDEX audit_logs_request_duration_idx ON audit_logs(request_duration);

-- Create composite index for endpoint and method filtering
CREATE INDEX audit_logs_endpoint_method_idx ON audit_logs(request_endpoint, request_method);

-- Create composite index for status and timing analysis
CREATE INDEX audit_logs_status_duration_idx ON audit_logs(response_status, request_duration);

-- Add comments to document the new fields
COMMENT ON COLUMN audit_logs.request_method IS 'HTTP method (GET, POST, PUT, DELETE, etc.) of the request that triggered this audit log entry';
COMMENT ON COLUMN audit_logs.request_endpoint IS 'API endpoint or page URL that was accessed when this audit log entry was created';
COMMENT ON COLUMN audit_logs.request_headers IS 'Relevant HTTP headers stored as JSONB for flexibility. Sensitive headers should be filtered out.';
COMMENT ON COLUMN audit_logs.response_status IS 'HTTP status code returned by the request';
COMMENT ON COLUMN audit_logs.request_duration IS 'Time taken to process the request in milliseconds';

-- Update the audit trigger function to capture request metadata
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
  current_session_id TEXT;
  current_request_method TEXT;
  current_request_endpoint TEXT;
  current_request_headers JSONB;
  current_response_status INTEGER;
  current_request_duration INTEGER;
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

  -- Try to get request metadata from current_setting
  BEGIN
    current_request_method := current_setting('app.request_method', true);
    IF current_request_method = '' THEN
      current_request_method := NULL;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      current_request_method := NULL;
  END;

  BEGIN
    current_request_endpoint := current_setting('app.request_endpoint', true);
    IF current_request_endpoint = '' THEN
      current_request_endpoint := NULL;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      current_request_endpoint := NULL;
  END;

  BEGIN
    current_request_headers := current_setting('app.request_headers', true)::JSONB;
  EXCEPTION
    WHEN OTHERS THEN
      current_request_headers := NULL;
  END;

  BEGIN
    current_response_status := current_setting('app.response_status', true)::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      current_response_status := NULL;
  END;

  BEGIN
    current_request_duration := current_setting('app.request_duration', true)::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      current_request_duration := NULL;
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
      old_data,
      new_data,
      changed_fields,
      request_method,
      request_endpoint,
      request_headers,
      response_status,
      request_duration
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      auth.uid(),
      current_session_id,
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record'],
      current_request_method,
      current_request_endpoint,
      current_request_headers,
      current_response_status,
      current_request_duration
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
        changed_fields,
        request_method,
        request_endpoint,
        request_headers,
        response_status,
        request_duration
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        auth.uid(),
        current_session_id,
        old_data,
        new_data,
        changed_fields,
        current_request_method,
        current_request_endpoint,
        current_request_headers,
        current_response_status,
        current_request_duration
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
      changed_fields,
      request_method,
      request_endpoint,
      request_headers,
      response_status,
      request_duration
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      auth.uid(),
      current_session_id,
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record'],
      current_request_method,
      current_request_endpoint,
      current_request_headers,
      current_response_status,
      current_request_duration
    );
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_audit_history function to include request metadata
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
  request_method TEXT,
  request_endpoint TEXT,
  request_headers JSONB,
  response_status INTEGER,
  request_duration INTEGER
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
    audit_logs.request_method,
    audit_logs.request_endpoint,
    audit_logs.request_headers,
    audit_logs.response_status,
    audit_logs.request_duration
  FROM audit_logs
  WHERE table_name = p_table_name
    AND record_id = p_record_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_field_history function to include request metadata
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
  request_method TEXT,
  request_endpoint TEXT,
  request_headers JSONB,
  response_status INTEGER,
  request_duration INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    audit_logs.changed_at,
    old_data->>p_field_name as old_value,
    new_data->>p_field_name as new_value,
    user_id as changed_by,
    audit_logs.session_id,
    audit_logs.request_method,
    audit_logs.request_endpoint,
    audit_logs.request_headers,
    audit_logs.response_status,
    audit_logs.request_duration
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

-- Update the get_audit_logs_by_session function to include request metadata
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
  request_method TEXT,
  request_endpoint TEXT,
  request_headers JSONB,
  response_status INTEGER,
  request_duration INTEGER
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
    audit_logs.request_method,
    audit_logs.request_endpoint,
    audit_logs.request_headers,
    audit_logs.response_status,
    audit_logs.request_duration
  FROM audit_logs
  WHERE audit_logs.session_id = p_session_id
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new function to get audit logs by request endpoint
CREATE OR REPLACE FUNCTION get_audit_logs_by_endpoint(
  p_endpoint TEXT,
  p_method TEXT DEFAULT NULL,
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
  request_method TEXT,
  request_endpoint TEXT,
  request_headers JSONB,
  response_status INTEGER,
  request_duration INTEGER
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
    audit_logs.request_method,
    audit_logs.request_endpoint,
    audit_logs.request_headers,
    audit_logs.response_status,
    audit_logs.request_duration
  FROM audit_logs
  WHERE audit_logs.request_endpoint = p_endpoint
    AND (p_method IS NULL OR audit_logs.request_method = p_method)
  ORDER BY changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get performance statistics by endpoint
CREATE OR REPLACE FUNCTION get_endpoint_performance_stats(
  p_endpoint TEXT DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  endpoint TEXT,
  method TEXT,
  total_requests INTEGER,
  avg_duration NUMERIC,
  min_duration INTEGER,
  max_duration INTEGER,
  success_rate NUMERIC,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    audit_logs.request_endpoint as endpoint,
    audit_logs.request_method as method,
    COUNT(*)::INTEGER as total_requests,
    ROUND(AVG(audit_logs.request_duration), 2) as avg_duration,
    MIN(audit_logs.request_duration) as min_duration,
    MAX(audit_logs.request_duration) as max_duration,
    ROUND(
      COUNT(CASE WHEN audit_logs.response_status BETWEEN 200 AND 299 THEN 1 END) * 100.0 / COUNT(*), 2
    ) as success_rate,
    ROUND(
      COUNT(CASE WHEN audit_logs.response_status >= 400 THEN 1 END) * 100.0 / COUNT(*), 2
    ) as error_rate
  FROM audit_logs
  WHERE audit_logs.request_endpoint IS NOT NULL
    AND audit_logs.request_duration IS NOT NULL
    AND audit_logs.response_status IS NOT NULL
    AND (p_endpoint IS NULL OR audit_logs.request_endpoint = p_endpoint)
    AND (p_start_date IS NULL OR audit_logs.changed_at >= p_start_date)
    AND (p_end_date IS NULL OR audit_logs.changed_at <= p_end_date)
  GROUP BY audit_logs.request_endpoint, audit_logs.request_method
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_audit_logs_by_endpoint TO authenticated;
GRANT EXECUTE ON FUNCTION get_endpoint_performance_stats TO authenticated;

-- Create helper function to set request context
CREATE OR REPLACE FUNCTION set_request_context(
  p_method TEXT,
  p_endpoint TEXT,
  p_headers JSONB DEFAULT NULL,
  p_status INTEGER DEFAULT NULL,
  p_duration INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.request_method', p_method, true);
  PERFORM set_config('app.request_endpoint', p_endpoint, true);
  
  IF p_headers IS NOT NULL THEN
    PERFORM set_config('app.request_headers', p_headers::TEXT, true);
  END IF;
  
  IF p_status IS NOT NULL THEN
    PERFORM set_config('app.response_status', p_status::TEXT, true);
  END IF;
  
  IF p_duration IS NOT NULL THEN
    PERFORM set_config('app.request_duration', p_duration::TEXT, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the helper function
GRANT EXECUTE ON FUNCTION set_request_context TO authenticated;

-- Update table comment to reflect new capabilities
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all data changes. Tracks who changed what, when, the before/after values, and the HTTP request context including method, endpoint, headers, status, and timing information.';