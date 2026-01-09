-- Fix deal_stages table and deals foreign key constraint

-- Step 1: Drop existing foreign key constraints
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_id_fkey;
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS fk_deals_stage_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Step 2: Create deal_stages table (matching the Edge Function expectations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stages') THEN
    CREATE TABLE deal_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3B82F6',
      order_position INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      is_final BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Step 3: Insert default deal stages
INSERT INTO deal_stages (name, color, order_position, description, is_final) VALUES
  ('Lead', '#6366F1', 1, 'Initial lead qualification', false),
  ('Qualified', '#3B82F6', 2, 'Qualified opportunity', false),
  ('Proposal', '#F59E0B', 3, 'Proposal submitted', false),
  ('Negotiation', '#EF4444', 4, 'Terms negotiation', false),
  ('Closed Won', '#10B981', 5, 'Deal won', true),
  ('Closed Lost', '#6B7280', 6, 'Deal lost', true)
ON CONFLICT (name) DO NOTHING;

-- Step 4: Add stage_id column to deals if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_id') THEN
    ALTER TABLE deals ADD COLUMN stage_id UUID;
  END IF;
END $$;

-- Step 5: Fix existing deals with invalid stage_id
DO $$
DECLARE
  invalid_count INTEGER;
  lead_stage_id UUID;
BEGIN
  -- Get the Lead stage ID
  SELECT id INTO lead_stage_id FROM deal_stages WHERE name = 'Lead' LIMIT 1;
  
  -- Count and fix invalid stage_id values
  SELECT COUNT(*) INTO invalid_count
  FROM deals 
  WHERE stage_id IS NULL 
    OR stage_id NOT IN (SELECT id FROM deal_stages);
  
  IF invalid_count > 0 THEN
    -- Update all invalid/null stage_id values to Lead
    UPDATE deals 
    SET stage_id = lead_stage_id
    WHERE stage_id IS NULL 
      OR stage_id NOT IN (SELECT id FROM deal_stages);
  END IF;
END $$;

-- Step 6: Add foreign key constraint
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals 
    ADD CONSTRAINT fk_deals_stage_id 
    FOREIGN KEY (stage_id) REFERENCES deal_stages(id) ON DELETE SET NULL;
  EXCEPTION 
    WHEN duplicate_object THEN 
      NULL; -- Constraint already exists
  END;
END $$;

-- Step 7: If we had created 'stages' table, migrate data to 'deal_stages' and drop it
DO $$
DECLARE
  stages_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'stages'
  ) INTO stages_exists;
  
  IF stages_exists THEN
    -- Migrate any data from stages to deal_stages that doesn't already exist
    INSERT INTO deal_stages (name, order_position, created_at, updated_at)
    SELECT name, position, created_at, updated_at
    FROM stages
    ON CONFLICT (name) DO NOTHING;
    
    -- Drop the old stages table
    DROP TABLE IF EXISTS stages;
  END IF;
END $$;