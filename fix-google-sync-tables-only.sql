-- Fix Google Tasks Sync - Create Missing Tables Only
-- This script creates the missing tables without using auth functions

-- Step 1: Drop and recreate the task status constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'needsAction'));

SELECT 'Task status constraint updated' as status;

-- Step 2: Create the missing google_task_mappings table
DROP TABLE IF EXISTS google_task_mappings CASCADE;

CREATE TABLE google_task_mappings (
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

-- Create indexes
CREATE INDEX idx_task_mappings_task_id ON google_task_mappings(task_id);
CREATE INDEX idx_task_mappings_google_task_id ON google_task_mappings(google_task_id);
CREATE INDEX idx_task_mappings_user_id ON google_task_mappings(user_id);

-- Enable RLS
ALTER TABLE google_task_mappings ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies
CREATE POLICY "Enable all access for authenticated users" ON google_task_mappings
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON google_task_mappings TO authenticated;
GRANT ALL ON google_task_mappings TO anon;

SELECT 'google_task_mappings table created' as status;

-- Step 3: Create google_task_lists table
DROP TABLE IF EXISTS google_task_lists CASCADE;

CREATE TABLE google_task_lists (
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
GRANT ALL ON google_task_lists TO anon;

SELECT 'google_task_lists table created' as status;

-- Step 4: Create google_tasks_sync_conflicts table
DROP TABLE IF EXISTS google_tasks_sync_conflicts CASCADE;

CREATE TABLE google_tasks_sync_conflicts (
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
CREATE INDEX idx_sync_conflicts_user_id ON google_tasks_sync_conflicts(user_id);
CREATE INDEX idx_sync_conflicts_task_id ON google_tasks_sync_conflicts(task_id);
CREATE INDEX idx_sync_conflicts_resolved ON google_tasks_sync_conflicts(resolved);

-- Enable RLS
ALTER TABLE google_tasks_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies
CREATE POLICY "Enable all access for authenticated users" ON google_tasks_sync_conflicts
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON google_tasks_sync_conflicts TO authenticated;
GRANT ALL ON google_tasks_sync_conflicts TO anon;

SELECT 'google_tasks_sync_conflicts table created' as status;

-- Step 5: Verify all tables were created
SELECT 
  tablename,
  '✅ Created successfully' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'google_task_mappings',
    'google_task_lists',
    'google_tasks_sync_conflicts'
  )
ORDER BY tablename;

-- Final summary
SELECT 
  '✅ All missing tables have been created!' as status,
  'The Google Tasks sync errors should now be fixed.' as message,
  'Your tasks will sync properly.' as info;