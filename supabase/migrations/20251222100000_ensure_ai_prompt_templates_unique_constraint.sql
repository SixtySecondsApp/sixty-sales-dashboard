-- Ensure ai_prompt_templates has the required unique constraint for upsert operations
--
-- The frontend uses Supabase upsert with `onConflict: 'user_id,category'`.
-- This requires a UNIQUE constraint on (user_id, category).
--
-- This migration uses a simpler approach:
-- 1. Drop the constraint if it exists (idempotent)
-- 2. Remove any duplicate rows
-- 3. Create the constraint

-- Step 1: Drop existing constraint if it exists (safe to run multiple times)
ALTER TABLE public.ai_prompt_templates
DROP CONSTRAINT IF EXISTS ai_prompt_templates_user_id_category_key;

-- Step 2: Remove duplicates, keeping only the most recent row per (user_id, category)
DELETE FROM public.ai_prompt_templates a
USING public.ai_prompt_templates b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.category = b.category
  AND a.user_id IS NOT NULL;

-- Step 3: Create the unique constraint
ALTER TABLE public.ai_prompt_templates
ADD CONSTRAINT ai_prompt_templates_user_id_category_key
UNIQUE (user_id, category);
