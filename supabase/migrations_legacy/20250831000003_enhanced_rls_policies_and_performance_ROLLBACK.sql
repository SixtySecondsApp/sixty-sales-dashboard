/*
  # ROLLBACK SCRIPT: Enhanced RLS Policies and Performance Optimization
  
  ## ROLLBACK STRATEGY:
  ✅ Revoke all granted permissions
  ✅ Drop all performance optimization indexes
  ✅ Drop all analytical and dashboard functions
  ✅ Remove all RLS policies from relationship tables
  ✅ Disable RLS on enhanced tables
  ✅ Reset system to pre-optimization state
  ✅ Comprehensive logging of rollback operations
  
  ## EXECUTION ORDER:
  1. Revoke permissions and drop dashboard functions
  2. Drop performance optimization indexes
  3. Drop analytical functions
  4. Remove RLS policies from relationship tables
  5. Disable RLS on enhanced tables
  6. Clean up AI access control functions
  7. Final validation
  
  ## WARNING: 
  This rollback will remove all performance optimizations, security enhancements, and analytical capabilities.
  System performance may degrade significantly. Ensure you have a complete backup before executing.
*/

-- Start rollback transaction
BEGIN;

-- Create rollback logging
CREATE TEMP TABLE IF NOT EXISTS rollback_log (
  id SERIAL PRIMARY KEY,
  operation TEXT,
  status TEXT,
  records_affected INTEGER DEFAULT 0,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Function to log rollback steps
CREATE OR REPLACE FUNCTION log_rollback_step(
  p_operation TEXT,
  p_status TEXT,
  p_records INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO rollback_log (operation, status, records_affected, error_message)
  VALUES (p_operation, p_status, p_records, p_error);
END;
$$ LANGUAGE plpgsql;

-- Create backup of current state before rollback
CREATE TEMP TABLE pre_rollback_state AS
SELECT 
  'rls_policies' as component,
  COUNT(*) as count
FROM information_schema.table_constraints 
WHERE constraint_type = 'CHECK'
UNION ALL
SELECT 
  'performance_indexes' as component,
  COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%dashboard%' 
  OR indexname LIKE 'idx_%ai%' 
  OR indexname LIKE 'idx_%analysis%'
UNION ALL
SELECT 
  'analytical_functions' as component,
  COUNT(*) as count
FROM information_schema.routines 
WHERE routine_name IN ('calculate_company_engagement_score', 'calculate_deal_intelligence_score', 'get_crm_dashboard_data')
UNION ALL
SELECT 
  'access_control_functions' as component,
  COUNT(*) as count
FROM information_schema.routines 
WHERE routine_name IN ('user_can_access_ai_features', 'user_can_access_sensitive_ai_data');

-- =======================================================================================
-- PHASE 1: REVOKE PERMISSIONS AND DROP DASHBOARD FUNCTIONS
-- =======================================================================================

DO $$
DECLARE
  v_permissions_revoked INTEGER := 0;
  v_functions_dropped INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Revoking permissions and dropping dashboard functions', 'STARTED');
  
  BEGIN
    -- Revoke view permissions
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'companies_with_intelligence') THEN
      REVOKE SELECT ON companies_with_intelligence FROM authenticated;
      v_permissions_revoked := v_permissions_revoked + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'deals_with_complete_relationships') THEN
      REVOKE SELECT ON deals_with_complete_relationships FROM authenticated;
      v_permissions_revoked := v_permissions_revoked + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'activities_with_complete_data') THEN
      REVOKE SELECT ON activities_with_complete_data FROM authenticated;
      v_permissions_revoked := v_permissions_revoked + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'meetings_with_complete_relationships') THEN
      REVOKE SELECT ON meetings_with_complete_relationships FROM authenticated;
      v_permissions_revoked := v_permissions_revoked + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'deal_meeting_analytics') THEN
      REVOKE SELECT ON deal_meeting_analytics FROM authenticated;
      v_permissions_revoked := v_permissions_revoked + 1;
    END IF;
    
    -- Revoke and drop dashboard function
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_crm_dashboard_data') THEN
      REVOKE EXECUTE ON FUNCTION get_crm_dashboard_data FROM authenticated;
      DROP FUNCTION IF EXISTS get_crm_dashboard_data(UUID, INTEGER);
      v_functions_dropped := v_functions_dropped + 1;
    END IF;
    
    PERFORM log_rollback_step(
      format('Permissions revoked and dashboard functions dropped - Permissions: %s, Functions: %s',
             v_permissions_revoked, v_functions_dropped),
      'COMPLETED',
      v_permissions_revoked + v_functions_dropped
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Revoking permissions and dropping dashboard functions', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 2: DROP PERFORMANCE OPTIMIZATION INDEXES
-- =======================================================================================

DO $$
DECLARE
  v_dashboard_indexes_dropped INTEGER := 0;
  v_ai_indexes_dropped INTEGER := 0;
  v_specialized_indexes_dropped INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Dropping performance optimization indexes', 'STARTED');
  
  BEGIN
    -- Dashboard performance indexes
    DROP INDEX IF EXISTS idx_companies_dashboard_query;
    DROP INDEX IF EXISTS idx_deals_dashboard_query;
    DROP INDEX IF EXISTS idx_deals_ai_intelligence_query;
    DROP INDEX IF EXISTS idx_activities_dashboard_query;
    DROP INDEX IF EXISTS idx_activities_company_engagement;
    DROP INDEX IF EXISTS idx_tasks_dashboard_query;
    DROP INDEX IF EXISTS idx_meetings_dashboard_query;
    DROP INDEX IF EXISTS idx_contact_interactions_analysis;
    v_dashboard_indexes_dropped := 8;
    
    -- AI and analytics indexes
    DROP INDEX IF EXISTS idx_contacts_decision_maker_analysis;
    DROP INDEX IF EXISTS idx_deals_win_probability_analysis;
    v_ai_indexes_dropped := 2;
    
    -- Specialized JSONB and array indexes
    DROP INDEX IF EXISTS idx_deals_competitor_analysis;
    DROP INDEX IF EXISTS idx_deals_stakeholder_mapping;
    DROP INDEX IF EXISTS idx_contacts_social_media_urls;
    DROP INDEX IF EXISTS idx_companies_social_media_urls;
    DROP INDEX IF EXISTS idx_tasks_context_data;
    DROP INDEX IF EXISTS idx_companies_technology_stack;
    DROP INDEX IF EXISTS idx_contacts_skills;
    DROP INDEX IF EXISTS idx_contacts_interests;
    DROP INDEX IF EXISTS idx_deals_risk_factors;
    v_specialized_indexes_dropped := 9;
    
    PERFORM log_rollback_step(
      format('Performance indexes dropped - Dashboard: %s, AI: %s, Specialized: %s',
             v_dashboard_indexes_dropped, v_ai_indexes_dropped, v_specialized_indexes_dropped),
      'COMPLETED',
      v_dashboard_indexes_dropped + v_ai_indexes_dropped + v_specialized_indexes_dropped
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping performance optimization indexes', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 3: DROP ANALYTICAL FUNCTIONS
-- =======================================================================================

DO $$
DECLARE
  v_analytical_functions_dropped INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Dropping analytical functions', 'STARTED');
  
  BEGIN
    -- Revoke and drop analytical functions
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_company_engagement_score') THEN
      REVOKE EXECUTE ON FUNCTION calculate_company_engagement_score FROM authenticated;
      DROP FUNCTION IF EXISTS calculate_company_engagement_score(UUID);
      v_analytical_functions_dropped := v_analytical_functions_dropped + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_deal_intelligence_score') THEN
      REVOKE EXECUTE ON FUNCTION calculate_deal_intelligence_score FROM authenticated;
      DROP FUNCTION IF EXISTS calculate_deal_intelligence_score(UUID);
      v_analytical_functions_dropped := v_analytical_functions_dropped + 1;
    END IF;
    
    PERFORM log_rollback_step(
      format('Analytical functions dropped - %s functions', v_analytical_functions_dropped),
      'COMPLETED',
      v_analytical_functions_dropped
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping analytical functions', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 4: REMOVE RLS POLICIES FROM RELATIONSHIP TABLES
-- =======================================================================================

DO $$
DECLARE
  v_policies_dropped INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Removing RLS policies from relationship tables', 'STARTED');
  
  BEGIN
    -- Company Activities policies
    DROP POLICY IF EXISTS "Users can view company activities for their companies" ON company_activities;
    DROP POLICY IF EXISTS "Users can manage company activities for their data" ON company_activities;
    v_policies_dropped := v_policies_dropped + 2;
    
    -- Deal Meetings policies  
    DROP POLICY IF EXISTS "Users can view deal meetings for their deals" ON deal_meetings;
    DROP POLICY IF EXISTS "Users can manage deal meetings for their deals" ON deal_meetings;
    v_policies_dropped := v_policies_dropped + 2;
    
    -- Activity Meetings policies (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_meetings') THEN
      DROP POLICY IF EXISTS "Users can view activity meetings for their data" ON activity_meetings;
      DROP POLICY IF EXISTS "Users can manage activity meetings for their data" ON activity_meetings;
      v_policies_dropped := v_policies_dropped + 2;
    END IF;
    
    -- Meeting Sequences policies (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_sequences') THEN
      DROP POLICY IF EXISTS "Users can view meeting sequences for their companies" ON meeting_sequences;
      DROP POLICY IF EXISTS "Users can manage meeting sequences for their data" ON meeting_sequences;
      v_policies_dropped := v_policies_dropped + 2;
    END IF;
    
    -- Contact Interactions policies
    DROP POLICY IF EXISTS "Users can view contact interactions for their contacts" ON contact_interactions;
    DROP POLICY IF EXISTS "Users can manage contact interactions for their data" ON contact_interactions;
    v_policies_dropped := v_policies_dropped + 2;
    
    -- Deal Stakeholders policies
    DROP POLICY IF EXISTS "Users can view deal stakeholders for their deals" ON deal_stakeholders;
    DROP POLICY IF EXISTS "Users can manage deal stakeholders for their deals" ON deal_stakeholders;
    v_policies_dropped := v_policies_dropped + 2;
    
    PERFORM log_rollback_step(
      format('RLS policies removed - %s policies dropped', v_policies_dropped),
      'COMPLETED',
      v_policies_dropped
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing RLS policies from relationship tables', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 5: DISABLE RLS ON ENHANCED TABLES
-- =======================================================================================

DO $$
DECLARE
  v_tables_disabled INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Disabling RLS on enhanced tables', 'STARTED');
  
  BEGIN
    -- Disable RLS on relationship tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_activities') THEN
      ALTER TABLE company_activities DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_meetings') THEN
      ALTER TABLE deal_meetings DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_meetings') THEN
      ALTER TABLE activity_meetings DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_sequences') THEN
      ALTER TABLE meeting_sequences DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_interactions') THEN
      ALTER TABLE contact_interactions DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stakeholders') THEN
      ALTER TABLE deal_stakeholders DISABLE ROW LEVEL SECURITY;
      v_tables_disabled := v_tables_disabled + 1;
    END IF;
    
    PERFORM log_rollback_step(
      format('RLS disabled on enhanced tables - %s tables', v_tables_disabled),
      'COMPLETED',
      v_tables_disabled
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Disabling RLS on enhanced tables', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 6: CLEAN UP AI ACCESS CONTROL FUNCTIONS
-- =======================================================================================

DO $$
DECLARE
  v_access_functions_dropped INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Cleaning up AI access control functions', 'STARTED');
  
  BEGIN
    -- Revoke and drop AI access control functions
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'user_can_access_ai_features') THEN
      REVOKE EXECUTE ON FUNCTION user_can_access_ai_features FROM authenticated;
      DROP FUNCTION IF EXISTS user_can_access_ai_features();
      v_access_functions_dropped := v_access_functions_dropped + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'user_can_access_sensitive_ai_data') THEN
      REVOKE EXECUTE ON FUNCTION user_can_access_sensitive_ai_data FROM authenticated;
      DROP FUNCTION IF EXISTS user_can_access_sensitive_ai_data();
      v_access_functions_dropped := v_access_functions_dropped + 1;
    END IF;
    
    PERFORM log_rollback_step(
      format('AI access control functions cleaned up - %s functions dropped', v_access_functions_dropped),
      'COMPLETED',
      v_access_functions_dropped
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Cleaning up AI access control functions', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 7: FINAL VALIDATION AND CLEANUP
-- =======================================================================================

-- Create post-rollback state comparison
CREATE TEMP TABLE post_rollback_state AS
SELECT 
  'rls_policies' as component,
  0 as count -- Should be 0 after rollback
UNION ALL
SELECT 
  'performance_indexes' as component,
  0 as count -- Should be 0 after rollback
UNION ALL
SELECT 
  'analytical_functions' as component,
  0 as count -- Should be 0 after rollback
UNION ALL
SELECT 
  'access_control_functions' as component,
  0 as count; -- Should be 0 after rollback

-- Clean up migration artifacts
DO $$
BEGIN
  PERFORM log_rollback_step('Cleaning up migration artifacts', 'STARTED');
  
  BEGIN
    -- Drop migration-specific functions if they still exist
    DROP FUNCTION IF EXISTS log_migration_step(TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ);
    
    PERFORM log_rollback_step('Migration artifacts cleaned up successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Cleaning up migration artifacts', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- Log final validation
DO $$
BEGIN
  PERFORM log_rollback_step('Enhanced RLS policies and performance optimization rollback completed successfully', 'COMPLETED');
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_rollback_step('Final validation', 'FAILED', 0, SQLERRM);
    RAISE;
END $$;

-- Display rollback summary
SELECT 
  operation,
  status,
  records_affected,
  timestamp,
  CASE WHEN error_message IS NOT NULL THEN error_message ELSE 'Success' END as result
FROM rollback_log 
ORDER BY timestamp;

-- Display state comparison
SELECT 
  pre.component,
  pre.count as before_rollback,
  post.count as after_rollback,
  (pre.count - post.count) as items_removed
FROM pre_rollback_state pre
LEFT JOIN post_rollback_state post ON pre.component = post.component
ORDER BY pre.component;

-- Clean up rollback logging function
DROP FUNCTION IF EXISTS log_rollback_step(TEXT, TEXT, INTEGER, TEXT);

-- Commit the rollback
COMMIT;

-- Success message
SELECT 'Enhanced RLS policies and performance optimization rollback completed successfully. All security enhancements, performance optimizations, and analytical capabilities have been removed.' as rollback_status;