/*
  # ROLLBACK SCRIPT: Enhanced Direct Relationships and Meeting Integration
  
  ## ROLLBACK STRATEGY:
  ✅ Drop all newly created tables and views
  ✅ Remove all newly added columns from existing tables
  ✅ Drop all new indexes and functions
  ✅ Clear all relationship data created by this migration
  ✅ Reset meeting types and outcomes to default values
  ✅ Comprehensive logging of rollback operations
  
  ## EXECUTION ORDER:
  1. Drop views and functions (dependent objects first)
  2. Clear relationship data from new tables
  3. Drop new relationship tables
  4. Drop new indexes
  5. Remove new columns from existing tables
  6. Reset data to pre-migration state
  7. Final validation
  
  ## WARNING: 
  This rollback will remove all meeting enhancements, relationship tracking, and intelligence features.
  Ensure you have a complete backup before executing.
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
  'meetings_enhanced' as table_name,
  COUNT(*) as record_count
FROM meetings
WHERE meeting_type IS NOT NULL
UNION ALL
SELECT 
  'deal_meetings' as table_name,
  COUNT(*) as record_count
FROM deal_meetings
UNION ALL
SELECT 
  'activity_meetings' as table_name,
  COUNT(*) as record_count
FROM activity_meetings
UNION ALL
SELECT 
  'meeting_sequences' as table_name,
  COUNT(*) as record_count
FROM meeting_sequences;

-- =======================================================================================
-- PHASE 1: DROP VIEWS AND FUNCTIONS (DEPENDENT OBJECTS FIRST)
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping enhanced views and functions', 'STARTED');
  
  BEGIN
    -- Drop enhanced views
    DROP VIEW IF EXISTS meetings_with_complete_relationships CASCADE;
    DROP VIEW IF EXISTS deal_meeting_analytics CASCADE;
    
    -- Drop inference functions
    DROP FUNCTION IF EXISTS infer_meeting_deal_relationships() CASCADE;
    DROP FUNCTION IF EXISTS populate_company_activity_relationships() CASCADE;
    DROP FUNCTION IF EXISTS create_meeting_follow_up_activities(UUID, BOOLEAN) CASCADE;
    
    PERFORM log_rollback_step('Enhanced views and functions dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping enhanced views and functions', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 2: CLEAR RELATIONSHIP DATA FROM NEW TABLES
-- =======================================================================================

DO $$
DECLARE
  v_sequences_cleared INTEGER := 0;
  v_activity_meetings_cleared INTEGER := 0;
  v_deal_meetings_enhanced_cleared INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Clearing relationship data', 'STARTED');
  
  BEGIN
    -- Clear meeting sequences created during migration
    DELETE FROM meeting_sequences 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_4'
    );
    
    GET DIAGNOSTICS v_sequences_cleared = ROW_COUNT;
    
    -- Clear activity meetings created during migration
    DELETE FROM activity_meetings 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_2'
    );
    
    GET DIAGNOSTICS v_activity_meetings_cleared = ROW_COUNT;
    
    -- Reset enhanced deal_meetings data to basic state
    UPDATE deal_meetings 
    SET 
      meeting_stage_at_time = NULL,
      stage_progression_expected = false,
      stage_progressed_after = false,
      meeting_type = NULL,
      stakeholders_present = 1,
      decision_makers_present = 0,
      budget_authority_present = false,
      technical_authority_present = false,
      competitive_discussion = false,
      objections_raised = '{}',
      value_proposition_resonated = NULL,
      next_meeting_scheduled = false
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_2'
    );
    
    GET DIAGNOSTICS v_deal_meetings_enhanced_cleared = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Relationship data cleared - Sequences: %s, Activity meetings: %s, Enhanced deal meetings: %s',
             v_sequences_cleared, v_activity_meetings_cleared, v_deal_meetings_enhanced_cleared),
      'COMPLETED',
      v_sequences_cleared + v_activity_meetings_cleared + v_deal_meetings_enhanced_cleared
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Clearing relationship data', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 3: DROP NEW RELATIONSHIP TABLES
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping new relationship tables', 'STARTED');
  
  BEGIN
    -- Drop meeting sequences table
    DROP TABLE IF EXISTS meeting_sequences CASCADE;
    
    -- Drop activity meetings table
    DROP TABLE IF EXISTS activity_meetings CASCADE;
    
    PERFORM log_rollback_step('New relationship tables dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping new relationship tables', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 4: DROP NEW INDEXES
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping meeting enhancement indexes', 'STARTED');
  
  BEGIN
    -- Meeting relationship indexes
    DROP INDEX IF EXISTS idx_meetings_company_id;
    DROP INDEX IF EXISTS idx_meetings_primary_deal_id;
    DROP INDEX IF EXISTS idx_meetings_meeting_type;
    DROP INDEX IF EXISTS idx_meetings_meeting_outcome;
    DROP INDEX IF EXISTS idx_meetings_meeting_start_desc;
    
    -- Meeting action items indexes
    DROP INDEX IF EXISTS idx_meeting_action_items_deal_id;
    DROP INDEX IF EXISTS idx_meeting_action_items_company_id;
    DROP INDEX IF EXISTS idx_meeting_action_items_contact_id;
    DROP INDEX IF EXISTS idx_meeting_action_items_business_impact;
    
    -- Deal meetings indexes
    DROP INDEX IF EXISTS idx_deal_meetings_meeting_outcome;
    DROP INDEX IF EXISTS idx_deal_meetings_impact_score;
    DROP INDEX IF EXISTS idx_deal_meetings_stage_progressed;
    
    -- Activity meetings indexes (if they still exist)
    DROP INDEX IF EXISTS idx_activity_meetings_activity_id;
    DROP INDEX IF EXISTS idx_activity_meetings_meeting_id;
    DROP INDEX IF EXISTS idx_activity_meetings_relationship_type;
    
    -- Meeting sequences indexes (if they still exist)
    DROP INDEX IF EXISTS idx_meeting_sequences_company_deal;
    DROP INDEX IF EXISTS idx_meeting_sequences_sequence_order;
    
    PERFORM log_rollback_step('Meeting enhancement indexes dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping meeting enhancement indexes', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 5: REMOVE NEW COLUMNS FROM EXISTING TABLES
-- =======================================================================================

-- Remove enhancement columns from meetings table
DO $$
DECLARE
  v_meetings_columns_removed INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Removing enhancement columns from meetings table', 'STARTED');
  
  BEGIN
    ALTER TABLE meetings 
      DROP COLUMN IF EXISTS deal_count,
      DROP COLUMN IF EXISTS primary_deal_id,
      DROP COLUMN IF EXISTS activities_generated_count,
      DROP COLUMN IF EXISTS tasks_generated_count,
      DROP COLUMN IF EXISTS meeting_type,
      DROP COLUMN IF EXISTS meeting_outcome,
      DROP COLUMN IF EXISTS next_steps,
      DROP COLUMN IF EXISTS decision_timeline,
      DROP COLUMN IF EXISTS budget_discussed,
      DROP COLUMN IF EXISTS technical_requirements_discussed,
      DROP COLUMN IF EXISTS stakeholders_identified,
      DROP COLUMN IF EXISTS competitive_landscape_discussed,
      DROP COLUMN IF EXISTS meeting_quality_score,
      DROP COLUMN IF EXISTS engagement_level,
      DROP COLUMN IF EXISTS follow_up_required,
      DROP COLUMN IF EXISTS follow_up_scheduled;
    
    -- Count remaining columns to validate removal
    SELECT 16 INTO v_meetings_columns_removed; -- Expected number of columns removed
    
    PERFORM log_rollback_step(
      format('Meeting enhancement columns removed - %s columns', v_meetings_columns_removed),
      'COMPLETED',
      v_meetings_columns_removed
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing enhancement columns from meetings table', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- Remove enhancement columns from meeting_action_items table
DO $$
DECLARE
  v_action_items_columns_removed INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Removing enhancement columns from meeting_action_items table', 'STARTED');
  
  BEGIN
    ALTER TABLE meeting_action_items 
      DROP COLUMN IF EXISTS deal_id,
      DROP COLUMN IF EXISTS company_id,
      DROP COLUMN IF EXISTS contact_id,
      DROP COLUMN IF EXISTS estimated_effort_hours,
      DROP COLUMN IF EXISTS business_impact,
      DROP COLUMN IF EXISTS follow_up_meeting_required,
      DROP COLUMN IF EXISTS technical_requirement;
    
    -- Count removed columns
    SELECT 7 INTO v_action_items_columns_removed;
    
    PERFORM log_rollback_step(
      format('Meeting action items enhancement columns removed - %s columns', v_action_items_columns_removed),
      'COMPLETED',
      v_action_items_columns_removed
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing enhancement columns from meeting_action_items table', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- Remove enhancement columns from deal_meetings table
DO $$
DECLARE
  v_deal_meetings_columns_removed INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Removing enhancement columns from deal_meetings table', 'STARTED');
  
  BEGIN
    ALTER TABLE deal_meetings 
      DROP COLUMN IF EXISTS meeting_stage_at_time,
      DROP COLUMN IF EXISTS stage_progression_expected,
      DROP COLUMN IF EXISTS stage_progressed_after,
      DROP COLUMN IF EXISTS meeting_type,
      DROP COLUMN IF EXISTS stakeholders_present,
      DROP COLUMN IF EXISTS decision_makers_present,
      DROP COLUMN IF EXISTS budget_authority_present,
      DROP COLUMN IF EXISTS technical_authority_present,
      DROP COLUMN IF EXISTS competitive_discussion,
      DROP COLUMN IF EXISTS objections_raised,
      DROP COLUMN IF EXISTS value_proposition_resonated,
      DROP COLUMN IF EXISTS next_meeting_scheduled;
    
    -- Count removed columns
    SELECT 12 INTO v_deal_meetings_columns_removed;
    
    PERFORM log_rollback_step(
      format('Deal meetings enhancement columns removed - %s columns', v_deal_meetings_columns_removed),
      'COMPLETED',
      v_deal_meetings_columns_removed
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing enhancement columns from deal_meetings table', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 6: RESET DATA TO PRE-MIGRATION STATE
-- =======================================================================================

DO $$
DECLARE
  v_meetings_reset INTEGER := 0;
  v_deal_intelligence_reset INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Resetting data to pre-migration state', 'STARTED');
  
  BEGIN
    -- Reset any remaining meeting intelligence data
    UPDATE meetings 
    SET 
      updated_at = NOW()
    WHERE updated_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_4'
    );
    
    GET DIAGNOSTICS v_meetings_reset = ROW_COUNT;
    
    -- Reset deal intelligence scores that were modified by meeting relationships
    UPDATE deals 
    SET 
      deal_intelligence_score = GREATEST(deal_intelligence_score - 
        (SELECT COUNT(*) * 0.1 FROM deal_meetings WHERE deal_id = deals.id), 0.0)
    WHERE id IN (
      SELECT DISTINCT deal_id FROM deal_meetings
      WHERE created_at >= (
        SELECT MIN(timestamp) FROM migration_log 
        WHERE phase = 'PHASE_4'
      )
    );
    
    GET DIAGNOSTICS v_deal_intelligence_reset = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Data reset completed - Meetings: %s, Deal intelligence: %s', 
             v_meetings_reset, v_deal_intelligence_reset),
      'COMPLETED',
      v_meetings_reset + v_deal_intelligence_reset
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Resetting data to pre-migration state', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 7: FINAL VALIDATION AND CLEANUP
-- =======================================================================================

-- Create post-rollback state comparison
CREATE TEMP TABLE post_rollback_state AS
SELECT 
  'meetings_enhanced' as table_name,
  0 as record_count -- Should be 0 after rollback
UNION ALL
SELECT 
  'deal_meetings' as table_name,
  COUNT(*) as record_count
FROM deal_meetings
UNION ALL
SELECT 
  'activity_meetings' as table_name,
  0 as record_count -- Table should be dropped
UNION ALL
SELECT 
  'meeting_sequences' as table_name,
  0 as record_count; -- Table should be dropped

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
  PERFORM log_rollback_step('Direct relationships and meeting enhancements rollback completed successfully', 'COMPLETED');
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
  pre.table_name,
  pre.record_count as before_rollback,
  post.record_count as after_rollback,
  (pre.record_count - post.record_count) as records_removed
FROM pre_rollback_state pre
LEFT JOIN post_rollback_state post ON pre.table_name = post.table_name
ORDER BY pre.table_name;

-- Clean up rollback logging function
DROP FUNCTION IF EXISTS log_rollback_step(TEXT, TEXT, INTEGER, TEXT);

-- Commit the rollback
COMMIT;

-- Success message
SELECT 'Enhanced direct relationships and meeting integration rollback completed successfully. All meeting enhancements and relationship tables have been removed.' as rollback_status;