-- Fix workflow save functionality by adding missing columns
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/editor

-- Check current columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add the missing canvas_data column (REQUIRED for workflow saves)
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS canvas_data JSONB;

-- Add template_id column for template references
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS template_id TEXT;

-- Add priority_level column
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
AND table_schema = 'public'
ORDER BY ordinal_position;