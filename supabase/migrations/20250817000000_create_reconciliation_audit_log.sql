-- Create Reconciliation Audit Log Table
-- Phase 2: Comprehensive audit trail for reconciliation actions
-- Created: 2025-08-17

-- Create audit log table for tracking all reconciliation actions
CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
    id SERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    target_table TEXT,
    target_id INTEGER,
    confidence_score DECIMAL(5,2),
    metadata JSONB DEFAULT '{}',
    user_id TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_reconciliation_audit_user_id (user_id),
    INDEX idx_reconciliation_audit_action_type (action_type),
    INDEX idx_reconciliation_audit_executed_at (executed_at),
    INDEX idx_reconciliation_audit_source (source_table, source_id),
    INDEX idx_reconciliation_audit_target (target_table, target_id)
);

-- Add comments for documentation
COMMENT ON TABLE reconciliation_audit_log IS 'Comprehensive audit trail for all reconciliation actions including automatic and manual operations';
COMMENT ON COLUMN reconciliation_audit_log.action_type IS 'Type of reconciliation action performed (AUTO_LINK_HIGH_CONFIDENCE, MANUAL_LINK, CREATE_DEAL_FROM_ACTIVITY, etc.)';
COMMENT ON COLUMN reconciliation_audit_log.source_table IS 'Primary table being acted upon (sales_activities, deals)';
COMMENT ON COLUMN reconciliation_audit_log.source_id IS 'Primary record ID being acted upon';
COMMENT ON COLUMN reconciliation_audit_log.target_table IS 'Secondary table involved in the action (for linking operations)';
COMMENT ON COLUMN reconciliation_audit_log.target_id IS 'Secondary record ID involved in the action';
COMMENT ON COLUMN reconciliation_audit_log.confidence_score IS 'Confidence score for automatic matches (0-100)';
COMMENT ON COLUMN reconciliation_audit_log.metadata IS 'Additional context data including original values, match scores, etc.';
COMMENT ON COLUMN reconciliation_audit_log.user_id IS 'User who initiated the action (null for automatic actions)';

-- Create RLS policies for the audit log
ALTER TABLE reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit entries or all entries if they have admin privileges
CREATE POLICY "Users can view relevant audit entries" ON reconciliation_audit_log
FOR SELECT USING (
    user_id = auth.uid()::text OR 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- Only authenticated users can insert audit entries (typically done by API)
CREATE POLICY "Allow inserting audit entries" ON reconciliation_audit_log
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create helper view for recent reconciliation activity
CREATE OR REPLACE VIEW reconciliation_recent_activity AS
SELECT 
    ral.id,
    ral.action_type,
    ral.source_table,
    ral.source_id,
    ral.target_table,
    ral.target_id,
    ral.confidence_score,
    ral.metadata,
    ral.executed_at,
    ral.user_id,
    p.first_name,
    p.last_name,
    -- Extract company names from metadata for display
    COALESCE(
        ral.metadata->>'activity_company',
        ral.metadata->>'deal_company',
        ral.metadata->>'company_name'
    ) as company_name,
    -- Extract amounts from metadata
    COALESCE(
        (ral.metadata->>'activity_amount')::DECIMAL,
        (ral.metadata->>'deal_amount')::DECIMAL,
        (ral.metadata->>'amount')::DECIMAL
    ) as amount
FROM reconciliation_audit_log ral
LEFT JOIN profiles p ON p.id = ral.user_id::UUID
WHERE ral.executed_at >= NOW() - INTERVAL '30 days'
ORDER BY ral.executed_at DESC;

-- Add RLS to the view
ALTER VIEW reconciliation_recent_activity SET (security_barrier = true);

-- Create view for reconciliation statistics by action type
CREATE OR REPLACE VIEW reconciliation_action_stats AS
SELECT 
    action_type,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE executed_at >= CURRENT_DATE - INTERVAL '7 days') as last_7_days,
    COUNT(*) FILTER (WHERE executed_at >= CURRENT_DATE - INTERVAL '30 days') as last_30_days,
    AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) as avg_confidence_score,
    MIN(executed_at) as first_action,
    MAX(executed_at) as last_action,
    COUNT(DISTINCT user_id) as unique_users
FROM reconciliation_audit_log
GROUP BY action_type
ORDER BY total_actions DESC;

-- Create performance monitoring view
CREATE OR REPLACE VIEW reconciliation_performance_metrics AS
WITH daily_stats AS (
    SELECT 
        DATE(executed_at) as date,
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE action_type LIKE 'AUTO_%') as automatic_actions,
        COUNT(*) FILTER (WHERE action_type NOT LIKE 'AUTO_%' AND action_type NOT LIKE 'ERROR%') as manual_actions,
        COUNT(*) FILTER (WHERE action_type = 'ERROR') as errors,
        AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) as avg_confidence
    FROM reconciliation_audit_log
    WHERE executed_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(executed_at)
)
SELECT 
    date,
    total_actions,
    automatic_actions,
    manual_actions,
    errors,
    ROUND(avg_confidence, 2) as avg_confidence_score,
    CASE 
        WHEN total_actions > 0 THEN ROUND((total_actions - errors) * 100.0 / total_actions, 2)
        ELSE 100.0 
    END as success_rate,
    CASE 
        WHEN total_actions > 0 THEN ROUND(automatic_actions * 100.0 / total_actions, 2)
        ELSE 0.0 
    END as automation_rate
FROM daily_stats
ORDER BY date DESC;

-- Create indexes for performance on the new views
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_metadata_gin 
ON reconciliation_audit_log USING GIN (metadata);

-- Grant appropriate permissions
GRANT SELECT ON reconciliation_audit_log TO authenticated;
GRANT INSERT ON reconciliation_audit_log TO authenticated;
GRANT SELECT ON reconciliation_recent_activity TO authenticated;
GRANT SELECT ON reconciliation_action_stats TO authenticated;
GRANT SELECT ON reconciliation_performance_metrics TO authenticated;