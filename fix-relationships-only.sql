-- Fix just the critical relationship issues that are causing schema cache errors

-- 1. Add missing relationship columns
DO $$
BEGIN
  -- deals.owner_id relationship (this is critical for schema cache)
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
  
  -- Add missing required fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'subject') THEN
    ALTER TABLE activities ADD COLUMN subject TEXT;
    RAISE NOTICE '✅ Added subject to activities';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'start_time') THEN
    ALTER TABLE meetings ADD COLUMN start_time TIMESTAMPTZ;
    RAISE NOTICE '✅ Added start_time to meetings';
  END IF;
END $$;

-- 2. Add foreign key constraints
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

-- 3. Create stages table if missing (for deals)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages') THEN
    CREATE TABLE stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    INSERT INTO stages (name, position) VALUES
      ('Lead', 1),
      ('Qualified', 2), 
      ('Proposal', 3),
      ('Negotiation', 4),
      ('Closed Won', 5),
      ('Closed Lost', 6);
    
    RAISE NOTICE '✅ Created stages table';
  END IF;
  
  -- Add stage_id to deals
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_id') THEN
    ALTER TABLE deals ADD COLUMN stage_id UUID;
    
    -- Set default stage
    UPDATE deals SET stage_id = (SELECT id FROM stages WHERE name = 'Lead' LIMIT 1) WHERE stage_id IS NULL;
    
    -- Add FK constraint
    ALTER TABLE deals ADD CONSTRAINT fk_deals_stage_id FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Added stage_id to deals';
  END IF;
END $$;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT '🚀 Critical relationships fixed - schema cache errors should be resolved!' as result;