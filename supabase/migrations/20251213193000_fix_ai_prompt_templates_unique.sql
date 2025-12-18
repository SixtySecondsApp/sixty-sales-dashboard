-- Fix: ai_prompt_templates upsert requires UNIQUE(user_id, category)
--
-- The frontend uses Supabase upsert with `onConflict: 'user_id,category'`.
-- Postgres requires a UNIQUE or EXCLUSION constraint matching that conflict target.
--
-- This migration:
-- 1) De-duplicates existing rows per (user_id, category) by keeping the newest
-- 2) Ensures the required unique constraint exists

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_prompt_templates'
  ) THEN

    -- Remove duplicates that would prevent adding the unique constraint.
    -- Keep the most recently updated (fallback to created_at).
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, category
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        ) AS rn
      FROM public.ai_prompt_templates
      WHERE user_id IS NOT NULL
    )
    DELETE FROM public.ai_prompt_templates t
    USING ranked r
    WHERE t.id = r.id
      AND r.rn > 1;

    -- Add the unique constraint required for ON CONFLICT (user_id, category)
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ai_prompt_templates_user_id_category_key'
        AND conrelid = 'public.ai_prompt_templates'::regclass
    ) THEN
      ALTER TABLE public.ai_prompt_templates
        ADD CONSTRAINT ai_prompt_templates_user_id_category_key
        UNIQUE (user_id, category);
    END IF;

  END IF;
END $$;





