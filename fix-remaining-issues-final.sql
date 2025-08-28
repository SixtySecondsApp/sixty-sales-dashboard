-- Fix remaining issues to get from 9/30 to 25-30/30 tests passing

-- 1. Add missing relationships that are causing schema cache errors
DO $$
BEGIN
  -- deals.owner_id relationship (this is critical)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id') THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to deals';
  END IF;
  
  -- meetings.created_by relationship
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'created_by') THEN
    ALTER TABLE meetings ADD COLUMN created_by UUID;
    RAISE NOTICE '✅ Added created_by to meetings';
  END IF;
  
  -- activities.owner_id relationship
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'owner_id') THEN
    ALTER TABLE activities ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to activities';
  END IF;
  
  -- Add missing columns for validation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'subject') THEN
    ALTER TABLE activities ADD COLUMN subject TEXT;
    RAISE NOTICE '✅ Added subject to activities';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'start_time') THEN
    ALTER TABLE meetings ADD COLUMN start_time TIMESTAMPTZ;
    RAISE NOTICE '✅ Added start_time to meetings';
  END IF;
END $$;

-- 2. Add foreign key constraints for the relationships
DO $$
BEGIN
  -- deals -> auth.users (owner_id)
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added deals->users FK for owner_id';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- meetings -> auth.users (created_by)
  BEGIN
    ALTER TABLE meetings ADD CONSTRAINT fk_meetings_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added meetings->users FK for created_by';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- activities -> auth.users (owner_id)
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added activities->users FK for owner_id';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Check for stages table and create valid stage if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages') THEN
    -- Create stages table
    CREATE TABLE stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    -- Insert default stages
    INSERT INTO stages (name, position) VALUES
      ('Lead', 1),
      ('Qualified', 2),
      ('Proposal', 3),
      ('Negotiation', 4),
      ('Closed Won', 5),
      ('Closed Lost', 6);
    
    RAISE NOTICE '✅ Created stages table with default stages';
  END IF;
END $$;

-- 4. Add stage_id to deals if missing and set a default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_id') THEN
    ALTER TABLE deals ADD COLUMN stage_id UUID;
    
    -- Set default stage for existing deals
    UPDATE deals SET stage_id = (SELECT id FROM stages WHERE name = 'Lead' LIMIT 1) WHERE stage_id IS NULL;
    
    -- Add foreign key constraint
    ALTER TABLE deals ADD CONSTRAINT fk_deals_stage_id FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Added stage_id to deals with default values';
  END IF;
END $$;

-- 5. Check task status values and ensure we have the right enum or constraints
DO $$
BEGIN
  -- Check if tasks table has status constraints, if not add them
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'tasks' AND tc.constraint_type = 'CHECK' AND ccu.column_name = 'status'
  ) THEN
    -- Add check constraint for valid status values
    ALTER TABLE tasks ADD CONSTRAINT check_task_status 
    CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled'));
    
    RAISE NOTICE '✅ Added status constraint to tasks';
  END IF;
  
  -- Update any invalid status values to 'todo'
  UPDATE tasks SET status = 'todo' WHERE status NOT IN ('todo', 'in_progress', 'completed', 'cancelled');
END $$;

-- 6. Refresh the PostgREST schema cache to pick up all changes
NOTIFY pgrst, 'reload schema';

-- 7. Test that our fixes work
SELECT 
  '=== VERIFICATION ===' as section,
  (SELECT COUNT(*) FROM information_schema.foreign_key_column_usage WHERE table_name = 'deals') as deals_fk_count,
  (SELECT COUNT(*) FROM information_schema.foreign_key_column_usage WHERE table_name = 'meetings') as meetings_fk_count,
  (SELECT COUNT(*) FROM information_schema.foreign_key_column_usage WHERE table_name = 'activities') as activities_fk_count,
  (SELECT COUNT(*) FROM stages) as stages_count;

SELECT '🚀 All fixes applied - test suite should now get 25-30/30 passing!' as result;