-- ============================================================================
-- Fix Function Search Path Mutable Warnings
-- ============================================================================
-- Date: 2025-12-13
-- Purpose: Add SET search_path = public to all functions that were flagged
--          by the Supabase linter for having mutable search paths.
--
-- This prevents search path injection attacks where malicious schemas
-- could intercept function calls.
-- ============================================================================

-- Helper function to safely alter function search_path
CREATE OR REPLACE FUNCTION pg_temp.safe_set_search_path(func_name TEXT)
RETURNS VOID AS $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  -- Check if function exists (any overload)
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = func_name
  ) INTO func_exists;
  
  IF func_exists THEN
    -- Get all overloads and alter each one
    FOR func_exists IN
      SELECT TRUE FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name
    LOOP
      -- We'll use dynamic SQL with the function OID
      NULL; -- Placeholder, actual work done below
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Since ALTER FUNCTION doesn't support IF EXISTS, we use DO blocks
-- to check existence before altering

DO $$
BEGIN
  -- 1. record_email_send
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'record_email_send') THEN
    EXECUTE 'ALTER FUNCTION public.record_email_send SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter record_email_send: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 2. calculate_deal_risk_aggregate
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'calculate_deal_risk_aggregate') THEN
    EXECUTE 'ALTER FUNCTION public.calculate_deal_risk_aggregate SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter calculate_deal_risk_aggregate: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 3. get_team_scorecard_leaderboard
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_team_scorecard_leaderboard') THEN
    EXECUTE 'ALTER FUNCTION public.get_team_scorecard_leaderboard SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_team_scorecard_leaderboard: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 4. update_app_settings_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_app_settings_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_app_settings_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_app_settings_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 5. check_meeting_limits
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_meeting_limits') THEN
    EXECUTE 'ALTER FUNCTION public.check_meeting_limits SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter check_meeting_limits: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 6. get_meeting_structured_summary
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_meeting_structured_summary') THEN
    EXECUTE 'ALTER FUNCTION public.get_meeting_structured_summary SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_meeting_structured_summary: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 7. get_activation_funnel
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_activation_funnel') THEN
    EXECUTE 'ALTER FUNCTION public.get_activation_funnel SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_activation_funnel: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 8. get_high_risk_deals
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_high_risk_deals') THEN
    EXECUTE 'ALTER FUNCTION public.get_high_risk_deals SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_high_risk_deals: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 9. update_workflow_results_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_workflow_results_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_workflow_results_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_workflow_results_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 10. generate_referral_code
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_referral_code') THEN
    EXECUTE 'ALTER FUNCTION public.generate_referral_code SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter generate_referral_code: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 11. get_rep_scorecard_stats
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_rep_scorecard_stats') THEN
    EXECUTE 'ALTER FUNCTION public.get_rep_scorecard_stats SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_rep_scorecard_stats: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 12. was_email_sent
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'was_email_sent') THEN
    EXECUTE 'ALTER FUNCTION public.was_email_sent SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter was_email_sent: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 13. get_applicable_automation_rules
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_applicable_automation_rules') THEN
    EXECUTE 'ALTER FUNCTION public.get_applicable_automation_rules SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_applicable_automation_rules: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 14. get_competitor_analysis
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_competitor_analysis') THEN
    EXECUTE 'ALTER FUNCTION public.get_competitor_analysis SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_competitor_analysis: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 15. update_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 16. get_coaching_template_for_call_type
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_coaching_template_for_call_type') THEN
    EXECUTE 'ALTER FUNCTION public.get_coaching_template_for_call_type SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_coaching_template_for_call_type: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 17. mark_onboarding_complete
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'mark_onboarding_complete') THEN
    EXECUTE 'ALTER FUNCTION public.mark_onboarding_complete SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter mark_onboarding_complete: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 18. get_meetings_with_forward_movement
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_meetings_with_forward_movement') THEN
    EXECUTE 'ALTER FUNCTION public.get_meetings_with_forward_movement SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_meetings_with_forward_movement: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 19. get_meetings_with_competitors
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_meetings_with_competitors') THEN
    EXECUTE 'ALTER FUNCTION public.get_meetings_with_competitors SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_meetings_with_competitors: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 20. update_org_call_types_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_org_call_types_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_org_call_types_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_org_call_types_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 21. calculate_workflow_coverage
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'calculate_workflow_coverage') THEN
    EXECUTE 'ALTER FUNCTION public.calculate_workflow_coverage SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter calculate_workflow_coverage: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 22. refresh_meeting_aggregate_metrics
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'refresh_meeting_aggregate_metrics') THEN
    EXECUTE 'ALTER FUNCTION public.refresh_meeting_aggregate_metrics SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter refresh_meeting_aggregate_metrics: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 23. get_top_objections
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_top_objections') THEN
    EXECUTE 'ALTER FUNCTION public.get_top_objections SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_top_objections: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 24. set_signup_position
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'set_signup_position') THEN
    EXECUTE 'ALTER FUNCTION public.set_signup_position SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter set_signup_position: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 25. set_referral_code
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'set_referral_code') THEN
    EXECUTE 'ALTER FUNCTION public.set_referral_code SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter set_referral_code: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 26. get_meeting_classification_counts
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_meeting_classification_counts') THEN
    EXECUTE 'ALTER FUNCTION public.get_meeting_classification_counts SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_meeting_classification_counts: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 27. get_deal_active_risks
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_deal_active_risks') THEN
    EXECUTE 'ALTER FUNCTION public.get_deal_active_risks SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_deal_active_risks: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 28. get_meetings_by_classification
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_meetings_by_classification') THEN
    EXECUTE 'ALTER FUNCTION public.get_meetings_by_classification SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_meetings_by_classification: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 29. get_scorecard_template_for_type
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_scorecard_template_for_type') THEN
    EXECUTE 'ALTER FUNCTION public.get_scorecard_template_for_type SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_scorecard_template_for_type: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 30. update_deal_risk_tables_timestamp
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_deal_risk_tables_timestamp') THEN
    EXECUTE 'ALTER FUNCTION public.update_deal_risk_tables_timestamp SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_deal_risk_tables_timestamp: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 31. increment_referral_count
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'increment_referral_count') THEN
    EXECUTE 'ALTER FUNCTION public.increment_referral_count SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter increment_referral_count: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 32. update_coaching_scorecard_templates_timestamp
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_coaching_scorecard_templates_timestamp') THEN
    EXECUTE 'ALTER FUNCTION public.update_coaching_scorecard_templates_timestamp SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_coaching_scorecard_templates_timestamp: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 33. update_meeting_structured_summaries_timestamp
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_meeting_structured_summaries_timestamp') THEN
    EXECUTE 'ALTER FUNCTION public.update_meeting_structured_summaries_timestamp SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_meeting_structured_summaries_timestamp: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 34. seed_default_call_types
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_call_types') THEN
    EXECUTE 'ALTER FUNCTION public.seed_default_call_types SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter seed_default_call_types: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 35. update_pipeline_rules_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_pipeline_rules_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_pipeline_rules_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_pipeline_rules_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 36. calculate_effective_position
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'calculate_effective_position') THEN
    EXECUTE 'ALTER FUNCTION public.calculate_effective_position SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter calculate_effective_position: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 37. update_launch_checklist_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_launch_checklist_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_launch_checklist_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_launch_checklist_updated_at: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 38. trigger_recalculate_deal_risk
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'trigger_recalculate_deal_risk') THEN
    EXECUTE 'ALTER FUNCTION public.trigger_recalculate_deal_risk SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter trigger_recalculate_deal_risk: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- 39. record_activation_event
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'record_activation_event') THEN
    EXECUTE 'ALTER FUNCTION public.record_activation_event SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter record_activation_event: %', SQLERRM;
END $$;

-- Clean up the temp helper function
DROP FUNCTION IF EXISTS pg_temp.safe_set_search_path(TEXT);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Function Search Path Fix Applied';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Attempted to set search_path = public on 39 functions';
  RAISE NOTICE 'Functions that did not exist were skipped safely';
  RAISE NOTICE '========================================';
END $$;
