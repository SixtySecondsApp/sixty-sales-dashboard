/*
  # ROLLBACK SCRIPT: Enhanced CRM Schema Design
  
  ## ROLLBACK STRATEGY:
  ✅ Drop all newly created tables and views
  ✅ Remove all newly added columns from existing tables
  ✅ Drop all new indexes
  ✅ Clean up all temporary functions
  ✅ Comprehensive logging of rollback operations
  
  ## EXECUTION ORDER:
  1. Drop views (dependent objects first)
  2. Drop new relationship tables
  3. Drop new indexes
  4. Remove new columns from existing tables
  5. Clean up functions and triggers
  
  ## WARNING: 
  This rollback will permanently remove all AI-ready fields and relationship data.
  Ensure you have a complete backup before executing.
*/

-- Start rollback transaction
BEGIN;

-- Create rollback logging
CREATE TEMP TABLE IF NOT EXISTS rollback_log (
  id SERIAL PRIMARY KEY,
  operation TEXT,
  status TEXT,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Function to log rollback steps
CREATE OR REPLACE FUNCTION log_rollback_step(
  p_operation TEXT,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO rollback_log (operation, status, error_message)
  VALUES (p_operation, p_status, p_error);
END;
$$ LANGUAGE plpgsql;

-- =======================================================================================
-- PHASE 1: DROP VIEWS (DEPENDENT OBJECTS FIRST)
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping enhanced views', 'STARTED');
  
  BEGIN
    DROP VIEW IF EXISTS companies_with_intelligence CASCADE;
    DROP VIEW IF EXISTS deals_with_complete_relationships CASCADE;
    DROP VIEW IF EXISTS activities_with_complete_data CASCADE;
    
    PERFORM log_rollback_step('Enhanced views dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping enhanced views', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 2: DROP NEW RELATIONSHIP TABLES
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping relationship tables', 'STARTED');
  
  BEGIN
    DROP TABLE IF EXISTS deal_stakeholders CASCADE;
    DROP TABLE IF EXISTS contact_interactions CASCADE;
    DROP TABLE IF EXISTS deal_meetings CASCADE;
    DROP TABLE IF EXISTS company_activities CASCADE;
    
    PERFORM log_rollback_step('Relationship tables dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping relationship tables', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 3: DROP NEW INDEXES
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Dropping AI and performance indexes', 'STARTED');
  
  BEGIN
    -- Companies indexes
    DROP INDEX IF EXISTS idx_companies_industry_confidence_score;
    DROP INDEX IF EXISTS idx_companies_size_confidence_score;
    DROP INDEX IF EXISTS idx_companies_engagement_score;
    DROP INDEX IF EXISTS idx_companies_lead_score;
    DROP INDEX IF EXISTS idx_companies_is_target_account;
    DROP INDEX IF EXISTS idx_companies_account_tier;
    DROP INDEX IF EXISTS idx_companies_enriched_at;
    
    -- Contacts indexes
    DROP INDEX IF EXISTS idx_contacts_job_seniority;
    DROP INDEX IF EXISTS idx_contacts_department;
    DROP INDEX IF EXISTS idx_contacts_decision_maker_score;
    DROP INDEX IF EXISTS idx_contacts_engagement_score;
    DROP INDEX IF EXISTS idx_contacts_last_interaction_date;
    DROP INDEX IF EXISTS idx_contacts_email_verified;
    
    -- Deals indexes
    DROP INDEX IF EXISTS idx_deals_intelligence_score;
    DROP INDEX IF EXISTS idx_deals_win_probability;
    DROP INDEX IF EXISTS idx_deals_opportunity_score;
    DROP INDEX IF EXISTS idx_deals_engagement_velocity;
    DROP INDEX IF EXISTS idx_deals_budget_confirmed;
    
    -- Activities indexes
    DROP INDEX IF EXISTS idx_activities_sentiment_score;
    DROP INDEX IF EXISTS idx_activities_engagement_quality;
    DROP INDEX IF EXISTS idx_activities_contact_identifier;
    DROP INDEX IF EXISTS idx_activities_activity_source;
    DROP INDEX IF EXISTS idx_activities_urgency_score;
    
    -- Tasks indexes
    DROP INDEX IF EXISTS idx_tasks_ai_priority_score;
    DROP INDEX IF EXISTS idx_tasks_success_probability;
    DROP INDEX IF EXISTS idx_tasks_impact_score;
    DROP INDEX IF EXISTS idx_tasks_auto_generated;
    DROP INDEX IF EXISTS idx_tasks_parent_task_id;
    
    PERFORM log_rollback_step('AI and performance indexes dropped successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Dropping AI and performance indexes', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 4: REMOVE NEW COLUMNS FROM EXISTING TABLES
-- =======================================================================================

-- Remove AI columns from companies table
DO $$
BEGIN
  PERFORM log_rollback_step('Removing AI columns from companies table', 'STARTED');
  
  BEGIN
    ALTER TABLE companies 
      DROP COLUMN IF EXISTS industry_confidence_score,
      DROP COLUMN IF EXISTS size_confidence_score,
      DROP COLUMN IF EXISTS enriched_at,
      DROP COLUMN IF EXISTS enrichment_source,
      DROP COLUMN IF EXISTS annual_revenue,
      DROP COLUMN IF EXISTS employee_count,
      DROP COLUMN IF EXISTS founding_year,
      DROP COLUMN IF EXISTS headquarters_location,
      DROP COLUMN IF EXISTS technology_stack,
      DROP COLUMN IF EXISTS social_media_urls,
      DROP COLUMN IF EXISTS engagement_score,
      DROP COLUMN IF EXISTS lead_score,
      DROP COLUMN IF EXISTS last_engagement_date,
      DROP COLUMN IF EXISTS is_target_account,
      DROP COLUMN IF EXISTS account_tier;
    
    PERFORM log_rollback_step('Companies AI columns removed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing AI columns from companies table', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- Remove AI columns from contacts table
DO $$
BEGIN
  PERFORM log_rollback_step('Removing AI columns from contacts table', 'STARTED');
  
  BEGIN
    ALTER TABLE contacts 
      DROP COLUMN IF EXISTS job_seniority,
      DROP COLUMN IF EXISTS department,
      DROP COLUMN IF EXISTS decision_maker_score,
      DROP COLUMN IF EXISTS engagement_score,
      DROP COLUMN IF EXISTS enriched_at,
      DROP COLUMN IF EXISTS enrichment_source,
      DROP COLUMN IF EXISTS social_media_urls,
      DROP COLUMN IF EXISTS interests,
      DROP COLUMN IF EXISTS skills,
      DROP COLUMN IF EXISTS last_interaction_date,
      DROP COLUMN IF EXISTS interaction_count,
      DROP COLUMN IF EXISTS email_domain_verified,
      DROP COLUMN IF EXISTS phone_verified,
      DROP COLUMN IF EXISTS timezone,
      DROP COLUMN IF EXISTS preferred_contact_method,
      DROP COLUMN IF EXISTS contact_quality_score;
    
    PERFORM log_rollback_step('Contacts AI columns removed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing AI columns from contacts table', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- Remove AI columns from deals table
DO $$
BEGIN
  PERFORM log_rollback_step('Removing AI columns from deals table', 'STARTED');
  
  BEGIN
    ALTER TABLE deals 
      DROP COLUMN IF EXISTS deal_intelligence_score,
      DROP COLUMN IF EXISTS win_probability_ai,
      DROP COLUMN IF EXISTS risk_factors,
      DROP COLUMN IF EXISTS opportunity_score,
      DROP COLUMN IF EXISTS competitor_analysis,
      DROP COLUMN IF EXISTS engagement_velocity,
      DROP COLUMN IF EXISTS last_meaningful_interaction,
      DROP COLUMN IF EXISTS decision_timeline,
      DROP COLUMN IF EXISTS budget_confirmed,
      DROP COLUMN IF EXISTS technical_fit_score,
      DROP COLUMN IF EXISTS stakeholder_mapping,
      DROP COLUMN IF EXISTS close_date_confidence;
    
    PERFORM log_rollback_step('Deals AI columns removed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing AI columns from deals table', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- Remove AI columns from activities table
DO $$
BEGIN
  PERFORM log_rollback_step('Removing AI columns from activities table', 'STARTED');
  
  BEGIN
    ALTER TABLE activities 
      DROP COLUMN IF EXISTS sentiment_score,
      DROP COLUMN IF EXISTS engagement_quality,
      DROP COLUMN IF EXISTS outcome_prediction,
      DROP COLUMN IF EXISTS follow_up_score,
      DROP COLUMN IF EXISTS response_time_minutes,
      DROP COLUMN IF EXISTS interaction_duration_minutes,
      DROP COLUMN IF EXISTS contact_identifier,
      DROP COLUMN IF EXISTS activity_source,
      DROP COLUMN IF EXISTS ai_generated_summary,
      DROP COLUMN IF EXISTS next_action_suggestion,
      DROP COLUMN IF EXISTS urgency_score;
    
    PERFORM log_rollback_step('Activities AI columns removed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing AI columns from activities table', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- Remove AI columns from tasks table
DO $$
BEGIN
  PERFORM log_rollback_step('Removing AI columns from tasks table', 'STARTED');
  
  BEGIN
    ALTER TABLE tasks 
      DROP COLUMN IF EXISTS ai_priority_score,
      DROP COLUMN IF EXISTS estimated_duration_minutes,
      DROP COLUMN IF EXISTS success_probability,
      DROP COLUMN IF EXISTS impact_score,
      DROP COLUMN IF EXISTS auto_generated,
      DROP COLUMN IF EXISTS parent_task_id,
      DROP COLUMN IF EXISTS sequence_order,
      DROP COLUMN IF EXISTS blocking_reason,
      DROP COLUMN IF EXISTS context_data;
    
    PERFORM log_rollback_step('Tasks AI columns removed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Removing AI columns from tasks table', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- =======================================================================================
-- PHASE 5: CLEAN UP FUNCTIONS AND FINAL VALIDATION
-- =======================================================================================

DO $$
BEGIN
  PERFORM log_rollback_step('Final cleanup and validation', 'STARTED');
  
  BEGIN
    -- Drop any migration-specific functions if they exist
    DROP FUNCTION IF EXISTS log_migration_step(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
    
    -- Validate rollback completion
    PERFORM log_rollback_step('Schema rollback completed successfully', 'COMPLETED');
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_rollback_step('Final cleanup and validation', 'FAILED', SQLERRM);
      RAISE;
  END;
END $$;

-- Display rollback summary
SELECT 
  operation,
  status,
  timestamp,
  CASE WHEN error_message IS NOT NULL THEN error_message ELSE 'Success' END as result
FROM rollback_log 
ORDER BY timestamp;

-- Clean up rollback logging function
DROP FUNCTION IF EXISTS log_rollback_step(TEXT, TEXT, TEXT);

-- Commit the rollback
COMMIT;

-- Success message
SELECT 'Enhanced CRM Schema Design rollback completed successfully. All AI-ready fields and relationship tables have been removed.' as rollback_status;