-- Migration: Migrate existing organization enrichment data to organization_context
-- Phase 2, Stage 2.2: Data migration for existing organizations
-- Date: 2026-01-01

-- =============================================================================
-- Migrate existing organization_enrichment data to organization_context
-- This extracts key-value pairs from the existing enrichment data
-- =============================================================================

-- Create a function to migrate enrichment data for a single organization
CREATE OR REPLACE FUNCTION migrate_enrichment_to_context(p_org_id UUID)
RETURNS INT AS $$
DECLARE
  v_enrichment RECORD;
  v_count INT := 0;
BEGIN
  -- Get enrichment data for the organization
  SELECT *
  INTO v_enrichment
  FROM organization_enrichment
  WHERE organization_id = p_org_id
    AND status = 'completed';

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Company Name
  IF v_enrichment.company_name IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'company_name', to_jsonb(v_enrichment.company_name), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Domain
  IF v_enrichment.domain IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'domain', to_jsonb(v_enrichment.domain), 'string', 'migration', 1.00)
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Tagline
  IF v_enrichment.tagline IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'tagline', to_jsonb(v_enrichment.tagline), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Description
  IF v_enrichment.description IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'description', to_jsonb(v_enrichment.description), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Industry
  IF v_enrichment.industry IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'industry', to_jsonb(v_enrichment.industry), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Employee Count
  IF v_enrichment.employee_count IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'employee_count', to_jsonb(v_enrichment.employee_count), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Target Market
  IF v_enrichment.target_market IS NOT NULL THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'target_market', to_jsonb(v_enrichment.target_market), 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Products (JSONB array)
  IF v_enrichment.products IS NOT NULL AND jsonb_array_length(v_enrichment.products) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'products', v_enrichment.products, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;

    -- Also set main_product from first product
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'main_product', v_enrichment.products->0->'name', 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
  END IF;

  -- Value Propositions
  IF v_enrichment.value_propositions IS NOT NULL AND jsonb_array_length(v_enrichment.value_propositions) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'value_propositions', v_enrichment.value_propositions, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Competitors
  IF v_enrichment.competitors IS NOT NULL AND jsonb_array_length(v_enrichment.competitors) > 0 THEN
    -- Extract just the names into an array
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    SELECT
      p_org_id,
      'competitors',
      jsonb_agg(c->>'name'),
      'array',
      'migration',
      COALESCE(v_enrichment.confidence_score, 0.80)
    FROM jsonb_array_elements(v_enrichment.competitors) c
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;

    -- Set primary competitor
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'primary_competitor', v_enrichment.competitors->0->'name', 'string', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
  END IF;

  -- Tech Stack
  IF v_enrichment.tech_stack IS NOT NULL AND jsonb_array_length(v_enrichment.tech_stack) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'tech_stack', v_enrichment.tech_stack, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Key People
  IF v_enrichment.key_people IS NOT NULL AND jsonb_array_length(v_enrichment.key_people) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'key_people', v_enrichment.key_people, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Pain Points
  IF v_enrichment.pain_points IS NOT NULL AND jsonb_array_length(v_enrichment.pain_points) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'pain_points', v_enrichment.pain_points, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Buying Signals
  IF v_enrichment.buying_signals IS NOT NULL AND jsonb_array_length(v_enrichment.buying_signals) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'buying_signals', v_enrichment.buying_signals, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- Customer Logos
  IF v_enrichment.customer_logos IS NOT NULL AND jsonb_array_length(v_enrichment.customer_logos) > 0 THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'customer_logos', v_enrichment.customer_logos, 'array', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  -- ICP Summary from ideal_customer_profile
  IF v_enrichment.ideal_customer_profile IS NOT NULL AND v_enrichment.ideal_customer_profile != '{}' THEN
    INSERT INTO organization_context (organization_id, context_key, value, value_type, source, confidence)
    VALUES (p_org_id, 'icp_summary', v_enrichment.ideal_customer_profile, 'object', 'migration', COALESCE(v_enrichment.confidence_score, 0.80))
    ON CONFLICT (organization_id, context_key) DO NOTHING;
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Run migration for all existing organizations with completed enrichment
-- =============================================================================

DO $$
DECLARE
  v_org RECORD;
  v_total_migrated INT := 0;
  v_org_count INT := 0;
BEGIN
  FOR v_org IN
    SELECT DISTINCT organization_id
    FROM organization_enrichment
    WHERE status = 'completed'
  LOOP
    v_total_migrated := v_total_migrated + migrate_enrichment_to_context(v_org.organization_id);
    v_org_count := v_org_count + 1;
  END LOOP;

  RAISE NOTICE 'Migrated % context values for % organizations', v_total_migrated, v_org_count;
END $$;

-- Drop the migration function (no longer needed after initial run)
-- Comment this out if you want to keep it for manual re-runs
-- DROP FUNCTION IF EXISTS migrate_enrichment_to_context(UUID);
