-- Add missing test_scenarios column to user_automation_rules table
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS test_scenarios JSONB DEFAULT '[]'::jsonb;