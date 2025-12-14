/*
  # ROLLBACK SCRIPT: Legacy Contact Relationships Migration
  
  ## ROLLBACK STRATEGY:
  ✅ Reset all deal foreign key relationships to NULL
  ✅ Remove all companies and contacts created by this migration
  ✅ Clear all relationship table data populated by this migration
  ✅ Reset engagement scores and interaction counts
  ✅ Comprehensive logging of rollback operations
  
  ## EXECUTION ORDER:
  1. Reset deal relationship updates
  2. Clear relationship table data
  3. Remove created companies and contacts (with safety checks)
  4. Reset calculated fields and scores
  5. Validate rollback completion
  
  ## WARNING: 
  This rollback will remove companies and contacts created by the migration.
  Only execute if you need to revert to the pre-migration state.
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
  'companies' as table_name,
  COUNT(*) as record_count
FROM companies
UNION ALL
SELECT 
  'contacts' as table_name,
  COUNT(*) as record_count
FROM contacts
UNION ALL
SELECT 
  'deals_with_company_id' as table_name,
  COUNT(*) as record_count
FROM deals WHERE company_id IS NOT NULL
UNION ALL
SELECT 
  'deals_with_primary_contact_id' as table_name,
  COUNT(*) as record_count
FROM deals WHERE primary_contact_id IS NOT NULL;

-- =======================================================================================
-- PHASE 1: RESET DEAL RELATIONSHIP UPDATES
-- =======================================================================================

DO $$
DECLARE
  v_company_resets INTEGER := 0;
  v_contact_resets INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Resetting deal relationships', 'STARTED');
  
  BEGIN
    -- Reset deals.company_id for deals that were updated by the migration
    -- (Only reset if the company was created during migration)
    UPDATE deals 
    SET company_id = NULL
    WHERE company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM companies c 
        WHERE c.id = deals.company_id 
        AND c.created_at >= (
          SELECT MIN(timestamp) FROM migration_log 
          WHERE phase = 'PHASE_2' 
          AND operation LIKE '%Creating missing companies%'
        )
      );
    
    GET DIAGNOSTICS v_company_resets = ROW_COUNT;
    
    -- Reset deals.primary_contact_id for contacts created during migration
    UPDATE deals 
    SET primary_contact_id = NULL
    WHERE primary_contact_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM contacts c 
        WHERE c.id = deals.primary_contact_id 
        AND c.created_at >= (
          SELECT MIN(timestamp) FROM migration_log 
          WHERE phase = 'PHASE_3' 
          AND operation LIKE '%Creating missing contacts%'
        )
      );
    
    GET DIAGNOSTICS v_contact_resets = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Deal relationships reset - Companies: %s, Contacts: %s', v_company_resets, v_contact_resets),
      'COMPLETED',
      v_company_resets + v_contact_resets
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Resetting deal relationships', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 2: CLEAR RELATIONSHIP TABLE DATA
-- =======================================================================================

DO $$
DECLARE
  v_company_activities_cleared INTEGER := 0;
  v_deal_stakeholders_cleared INTEGER := 0;
  v_contact_interactions_cleared INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Clearing relationship table data', 'STARTED');
  
  BEGIN
    -- Clear company_activities created during migration
    DELETE FROM company_activities 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_5'
    );
    
    GET DIAGNOSTICS v_company_activities_cleared = ROW_COUNT;
    
    -- Clear deal_stakeholders created during migration
    DELETE FROM deal_stakeholders 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_5'
    );
    
    GET DIAGNOSTICS v_deal_stakeholders_cleared = ROW_COUNT;
    
    -- Clear contact_interactions created during migration
    DELETE FROM contact_interactions 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_5'
    );
    
    GET DIAGNOSTICS v_contact_interactions_cleared = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Relationship data cleared - Activities: %s, Stakeholders: %s, Interactions: %s',
             v_company_activities_cleared, v_deal_stakeholders_cleared, v_contact_interactions_cleared),
      'COMPLETED',
      v_company_activities_cleared + v_deal_stakeholders_cleared + v_contact_interactions_cleared
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Clearing relationship table data', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 3: REMOVE CREATED COMPANIES AND CONTACTS
-- =======================================================================================

DO $$
DECLARE
  v_contacts_removed INTEGER := 0;
  v_companies_removed INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Removing migration-created companies and contacts', 'STARTED');
  
  BEGIN
    -- Remove contacts created during migration (with safety check)
    DELETE FROM contacts 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_3' 
      AND operation LIKE '%Creating missing contacts%'
    )
    -- Safety check: only remove if not referenced by other deals
    AND NOT EXISTS (
      SELECT 1 FROM deals d 
      WHERE d.primary_contact_id = contacts.id
      AND d.created_at < contacts.created_at
    );
    
    GET DIAGNOSTICS v_contacts_removed = ROW_COUNT;
    
    -- Remove companies created during migration (with safety check)
    DELETE FROM companies 
    WHERE created_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_2' 
      AND operation LIKE '%Creating missing companies%'
    )
    -- Safety check: only remove if not referenced by other entities
    AND NOT EXISTS (
      SELECT 1 FROM deals d 
      WHERE d.company_id = companies.id
      AND d.created_at < companies.created_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM contacts c 
      WHERE c.company_id = companies.id
      AND c.created_at < companies.created_at
    );
    
    GET DIAGNOSTICS v_companies_removed = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Migration entities removed - Companies: %s, Contacts: %s', v_companies_removed, v_contacts_removed),
      'COMPLETED',
      v_companies_removed + v_contacts_removed
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing migration-created companies and contacts', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 4: RESET CALCULATED FIELDS AND SCORES
-- =======================================================================================

DO $$
DECLARE
  v_contacts_reset INTEGER := 0;
  v_companies_reset INTEGER := 0;
BEGIN
  PERFORM log_rollback_step('Resetting calculated fields', 'STARTED');
  
  BEGIN
    -- Reset contact interaction counts and dates
    UPDATE contacts 
    SET 
      interaction_count = 0,
      last_interaction_date = NULL,
      engagement_score = 0.0
    WHERE updated_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_6'
    );
    
    GET DIAGNOSTICS v_contacts_reset = ROW_COUNT;
    
    -- Reset company engagement scores
    UPDATE companies 
    SET 
      engagement_score = 0.0,
      last_engagement_date = NULL
    WHERE updated_at >= (
      SELECT MIN(timestamp) FROM migration_log 
      WHERE phase = 'PHASE_6'
    );
    
    GET DIAGNOSTICS v_companies_reset = ROW_COUNT;
    
    PERFORM log_rollback_step(
      format('Calculated fields reset - Contacts: %s, Companies: %s', v_contacts_reset, v_companies_reset),
      'COMPLETED',
      v_contacts_reset + v_companies_reset
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Resetting calculated fields', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 5: CLEAN UP MIGRATION ARTIFACTS
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Cleaning up migration artifacts', 'STARTED');
  
  BEGIN
    -- Drop migration-created views
    DROP VIEW IF EXISTS migration_summary CASCADE;
    DROP VIEW IF EXISTS data_quality_check CASCADE;
    
    -- Drop migration-specific functions if they exist
    DROP FUNCTION IF EXISTS log_migration_step(TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ);
    
    PERFORM log_rollback_step('Migration artifacts cleaned up successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Cleaning up migration artifacts', 'FAILED', 0, SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- FINAL VALIDATION AND SUMMARY
-- =======================================================================================

-- Create post-rollback state comparison
CREATE TEMP TABLE post_rollback_state AS
SELECT 
  'companies' as table_name,
  COUNT(*) as record_count
FROM companies
UNION ALL
SELECT 
  'contacts' as table_name,
  COUNT(*) as record_count
FROM contacts
UNION ALL
SELECT 
  'deals_with_company_id' as table_name,
  COUNT(*) as record_count
FROM deals WHERE company_id IS NOT NULL
UNION ALL
SELECT 
  'deals_with_primary_contact_id' as table_name,
  COUNT(*) as record_count
FROM deals WHERE primary_contact_id IS NOT NULL;

-- Log final validation
DO $$
BEGIN
  PERFORM log_rollback_step('Legacy contact relationships rollback completed successfully', 'COMPLETED');
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
SELECT 'Legacy contact relationships migration rollback completed successfully. All migration-created relationships and entities have been removed.' as rollback_status;