-- Migration: Expand platform skill categories
-- Purpose: Add new categories required for Copilot execution layer
-- Adds: 'data-access', 'output-format'
-- Date: 2025-12-31

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing CHECK constraint on platform_skills.category (if any)
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'platform_skills'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%category%'
    AND pg_get_constraintdef(c.oid) ILIKE '%IN%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.platform_skills DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Recreate constraint with expanded categories
  ALTER TABLE public.platform_skills
    ADD CONSTRAINT platform_skills_category_check
    CHECK (
      category IN (
        'sales-ai',
        'writing',
        'enrichment',
        'workflows',
        'data-access',
        'output-format'
      )
    );
END $$;

