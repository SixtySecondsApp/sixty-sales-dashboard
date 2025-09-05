-- Add missing columns to user_automation_rules table if they don't exist

-- Add canvas_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_automation_rules' 
    AND column_name = 'canvas_data'
  ) THEN
    ALTER TABLE public.user_automation_rules ADD COLUMN canvas_data JSONB;
  END IF;
END $$;

-- Add trigger_conditions column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_automation_rules' 
    AND column_name = 'trigger_conditions'
  ) THEN
    ALTER TABLE public.user_automation_rules ADD COLUMN trigger_conditions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add action_config column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_automation_rules' 
    AND column_name = 'action_config'
  ) THEN
    ALTER TABLE public.user_automation_rules ADD COLUMN action_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add template_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_automation_rules' 
    AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.user_automation_rules ADD COLUMN template_id TEXT;
  END IF;
END $$;

-- Add priority_level column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_automation_rules' 
    AND column_name = 'priority_level'
  ) THEN
    ALTER TABLE public.user_automation_rules ADD COLUMN priority_level INTEGER DEFAULT 1;
  END IF;
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';