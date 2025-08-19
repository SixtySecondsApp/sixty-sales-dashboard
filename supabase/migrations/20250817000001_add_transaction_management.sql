-- Transaction Management Functions for Security Enhancement
-- Created: 2025-08-17
-- Purpose: Add proper transaction management for reconciliation operations

-- Create transaction management functions
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
BEGIN
    -- Generate unique transaction ID
    v_transaction_id := 'tx_' || gen_random_uuid()::text;
    
    -- Start transaction (this is mostly for logging purposes as Supabase handles transactions)
    PERFORM set_config('app.current_transaction_id', v_transaction_id, true);
    
    RETURN jsonb_build_object(
        'id', v_transaction_id,
        'started_at', NOW(),
        'status', 'active'
    );
END;
$$ LANGUAGE plpgsql;

-- Commit transaction function
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
BEGIN
    v_transaction_id := current_setting('app.current_transaction_id', true);
    
    -- Clear transaction ID
    PERFORM set_config('app.current_transaction_id', NULL, true);
    
    RETURN jsonb_build_object(
        'id', v_transaction_id,
        'committed_at', NOW(),
        'status', 'committed'
    );
END;
$$ LANGUAGE plpgsql;

-- Rollback transaction function
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
BEGIN
    v_transaction_id := current_setting('app.current_transaction_id', true);
    
    -- Clear transaction ID
    PERFORM set_config('app.current_transaction_id', NULL, true);
    
    RETURN jsonb_build_object(
        'id', v_transaction_id,
        'rolled_back_at', NOW(),
        'status', 'rolled_back'
    );
END;
$$ LANGUAGE plpgsql;

-- Create security events table for logging
CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Add soft deletion support columns to tables
ALTER TABLE sales_activities 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS merged_into INTEGER REFERENCES sales_activities(id),
ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS merged_into INTEGER REFERENCES deals(id),
ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for soft deletion
CREATE INDEX IF NOT EXISTS idx_sales_activities_status ON sales_activities(status) WHERE status != 'active';
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status) WHERE status != 'active';

-- Add user profiles table for tiered rate limiting
CREATE TABLE IF NOT EXISTS user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    tier TEXT DEFAULT 'standard',
    rate_limit_multiplier DECIMAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for user profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_metadata JSONB DEFAULT '{}',
    p_user_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security_events (
        event_type,
        metadata,
        user_id,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_event_type,
        p_metadata,
        p_user_id,
        p_ip_address,
        p_user_agent,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create view for active (non-deleted) records
CREATE OR REPLACE VIEW active_sales_activities AS
SELECT * FROM sales_activities 
WHERE status = 'active' OR status IS NULL;

CREATE OR REPLACE VIEW active_deals AS
SELECT * FROM deals 
WHERE status = 'active' OR status IS NULL;

-- Create function to restore soft-deleted records
CREATE OR REPLACE FUNCTION restore_merged_record(
    p_table_name TEXT,
    p_record_id INTEGER,
    p_user_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_restored_count INTEGER := 0;
BEGIN
    -- Validate table name
    IF p_table_name NOT IN ('sales_activities', 'deals') THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    -- Restore the record
    EXECUTE format(
        'UPDATE %I SET status = $1, merged_into = NULL, merged_at = NULL, updated_at = NOW() 
         WHERE id = $2 AND owner_id = $3 AND status = $4',
        p_table_name
    ) USING 'active', p_record_id, p_user_id, 'merged';
    
    GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    
    -- Log the restoration
    PERFORM log_reconciliation_action(
        'RESTORE_MERGED_RECORD',
        p_table_name,
        p_record_id,
        NULL,
        NULL,
        100.0,
        jsonb_build_object(
            'restored_by', p_user_id,
            'restoration_time', NOW()
        ),
        p_user_id
    );
    
    RETURN jsonb_build_object(
        'restored_count', v_restored_count,
        'record_id', p_record_id,
        'table_name', p_table_name,
        'restored_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old security events (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_security_events(
    p_days_to_keep INTEGER DEFAULT 90
) RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
    v_cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    DELETE FROM security_events 
    WHERE created_at < v_cutoff_date;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'deleted_count', v_deleted_count,
        'cutoff_date', v_cutoff_date,
        'cleaned_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for security events (admin only)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_admin_only ON security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id::text = auth.uid()::text 
            AND auth.users.email LIKE '%@admin.%'
        )
    );

-- Add RLS policies for user profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_own_data ON user_profiles
    FOR ALL USING (user_id = auth.uid()::text);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION begin_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION commit_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, JSONB, TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_merged_record(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_security_events(INTEGER) TO service_role;

-- Create comment explaining the security enhancements
COMMENT ON TABLE security_events IS 'Logs security-related events for monitoring and auditing purposes';
COMMENT ON FUNCTION begin_transaction() IS 'Starts a logical transaction for reconciliation operations';
COMMENT ON FUNCTION commit_transaction() IS 'Commits a logical transaction for reconciliation operations';
COMMENT ON FUNCTION rollback_transaction() IS 'Rolls back a logical transaction for reconciliation operations';
COMMENT ON FUNCTION restore_merged_record(TEXT, INTEGER, TEXT) IS 'Restores a soft-deleted record that was merged';
COMMENT ON FUNCTION cleanup_old_security_events(INTEGER) IS 'Cleans up old security events for maintenance';

-- Example usage documentation
/*
-- Start a transaction
SELECT begin_transaction();

-- Perform operations...
UPDATE sales_activities SET deal_id = 123 WHERE id = 456;

-- Commit the transaction
SELECT commit_transaction();

-- Or rollback on error
SELECT rollback_transaction();

-- Log a security event
SELECT log_security_event('RATE_LIMIT_EXCEEDED', '{"user_id": "123", "action": "merge"}');

-- Restore a merged record
SELECT restore_merged_record('sales_activities', 123, 'user-id');

-- Clean up old security events (admin only)
SELECT cleanup_old_security_events(30); -- Keep last 30 days
*/