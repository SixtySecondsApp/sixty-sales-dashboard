-- Fix Google Tasks Sync Errors
-- This script fixes the constraint violations and missing tables

-- Step 1: Check current task status constraint
SELECT 
  'Current Task Status Constraint:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'tasks_status_check';

-- Step 2: Drop and recreate the constraint to allow 'needsAction' status from Google
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'needsAction'));

DO $$
BEGIN
  RAISE NOTICE '✅ Updated task status constraint to accept Google Tasks statuses';
END $$;

-- Step 3: Create the missing google_task_mappings table
CREATE TABLE IF NOT EXISTS google_task_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  google_task_id TEXT NOT NULL,
  google_list_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id),
  UNIQUE(google_task_id, google_list_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_mappings_task_id ON google_task_mappings(task_id);
CREATE INDEX IF NOT EXISTS idx_task_mappings_google_task_id ON google_task_mappings(google_task_id);
CREATE INDEX IF NOT EXISTS idx_task_mappings_user_id ON google_task_mappings(user_id);

-- Enable RLS
ALTER TABLE google_task_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own mappings" ON google_task_mappings;
CREATE POLICY "Users can view their own mappings" ON google_task_mappings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own mappings" ON google_task_mappings;
CREATE POLICY "Users can insert their own mappings" ON google_task_mappings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mappings" ON google_task_mappings;
CREATE POLICY "Users can update their own mappings" ON google_task_mappings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own mappings" ON google_task_mappings;
CREATE POLICY "Users can delete their own mappings" ON google_task_mappings
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON google_task_mappings TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Created google_task_mappings table with RLS policies';
END $$;

-- Step 4: Also create google_task_lists table if missing
CREATE TABLE IF NOT EXISTS google_task_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_list_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  etag TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON google_task_lists TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Created google_task_lists table';
END $$;

-- Step 5: Create google_tasks_sync_conflicts table if missing
CREATE TABLE IF NOT EXISTS google_tasks_sync_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  google_task_id TEXT,
  google_list_id TEXT,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict', 'create_duplicate')),
  local_data JSONB,
  google_data JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON google_tasks_sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_task_id ON google_tasks_sync_conflicts(task_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON google_tasks_sync_conflicts(resolved);

-- Enable RLS
ALTER TABLE google_tasks_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own conflicts" ON google_tasks_sync_conflicts;
CREATE POLICY "Users can view their own conflicts" ON google_tasks_sync_conflicts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conflicts" ON google_tasks_sync_conflicts;
CREATE POLICY "Users can insert their own conflicts" ON google_tasks_sync_conflicts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conflicts" ON google_tasks_sync_conflicts;
CREATE POLICY "Users can update their own conflicts" ON google_tasks_sync_conflicts
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON google_tasks_sync_conflicts TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Created google_tasks_sync_conflicts table with RLS policies';
END $$;

-- Step 6: Verify all tables exist
SELECT 
  'Google Tasks Tables Status:' as info,
  tablename,
  CASE 
    WHEN tablename IS NOT NULL THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'google_tasks_sync_status',
    'google_tasks_list_configs', 
    'google_task_mappings',
    'google_task_lists',
    'google_tasks_sync_conflicts'
  )
ORDER BY tablename;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ All Google Tasks sync errors have been fixed!';
  RAISE NOTICE '📋 The sync should now work properly.';
  RAISE NOTICE '🔄 Tasks will sync bidirectionally between your app and Google Tasks.';
END $$;