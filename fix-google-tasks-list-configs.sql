-- Fix Google Tasks List Configs Table
-- This script safely creates or updates the table structure

-- First, check if the table exists
DO $$
BEGIN
  -- Create the table if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_tasks_list_configs') THEN
    CREATE TABLE google_tasks_list_configs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      google_list_id TEXT NOT NULL,
      list_title TEXT NOT NULL,
      sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'to_google', 'from_google')),
      is_primary BOOLEAN DEFAULT false,
      priority_filter TEXT[] DEFAULT '{}',
      task_categories TEXT[] DEFAULT '{}',
      status_filter TEXT[] DEFAULT '{}',
      auto_create_in_list BOOLEAN DEFAULT true,
      sync_enabled BOOLEAN DEFAULT true,
      display_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, google_list_id)
    );
    RAISE NOTICE 'Created google_tasks_list_configs table';
  ELSE
    RAISE NOTICE 'Table google_tasks_list_configs already exists';
  END IF;

  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'priority_filter') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN priority_filter TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added priority_filter column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'task_categories') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN task_categories TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added task_categories column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'status_filter') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN status_filter TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added status_filter column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'auto_create_in_list') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN auto_create_in_list BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added auto_create_in_list column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'sync_enabled') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN sync_enabled BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added sync_enabled column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_list_configs' AND column_name = 'display_order') THEN
    ALTER TABLE google_tasks_list_configs ADD COLUMN display_order INT DEFAULT 0;
    RAISE NOTICE 'Added display_order column';
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_configs_user_id') THEN
    CREATE INDEX idx_task_configs_user_id ON google_tasks_list_configs(user_id);
    RAISE NOTICE 'Created idx_task_configs_user_id index';
  ELSE
    RAISE NOTICE 'Index idx_task_configs_user_id already exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_configs_enabled') THEN
    CREATE INDEX idx_task_configs_enabled ON google_tasks_list_configs(sync_enabled);
    RAISE NOTICE 'Created idx_task_configs_enabled index';
  ELSE
    RAISE NOTICE 'Index idx_task_configs_enabled already exists';
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE google_tasks_list_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own list configs" ON google_tasks_list_configs;
  DROP POLICY IF EXISTS "Users can insert their own list configs" ON google_tasks_list_configs;
  DROP POLICY IF EXISTS "Users can update their own list configs" ON google_tasks_list_configs;
  DROP POLICY IF EXISTS "Users can delete their own list configs" ON google_tasks_list_configs;
  
  -- Create policies
  CREATE POLICY "Users can view their own list configs" ON google_tasks_list_configs
    FOR SELECT USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own list configs" ON google_tasks_list_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update their own list configs" ON google_tasks_list_configs
    FOR UPDATE USING (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own list configs" ON google_tasks_list_configs
    FOR DELETE USING (auth.uid() = user_id);
    
  RAISE NOTICE 'RLS policies created/updated';
END $$;

-- Grant permissions
GRANT ALL ON google_tasks_list_configs TO authenticated;

-- Verify the table structure
SELECT 
  'Table Structure:' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'google_tasks_list_configs'
ORDER BY ordinal_position;

-- Check if any configs exist
SELECT 
  'Existing Configs:' as info,
  COUNT(*) as config_count 
FROM google_tasks_list_configs;

-- Show RLS policies
SELECT 
  'RLS Policies:' as info,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'google_tasks_list_configs';

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Google Tasks List Configs table is ready for use!';
END $$;