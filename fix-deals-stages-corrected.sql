-- Fix deals stages foreign key constraint - Corrected Version

-- Step 1: Drop existing foreign key constraint if it exists
DO $$
BEGIN
  -- Drop constraint on deals table if it exists
  BEGIN
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_id_fkey;
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS fk_deals_stage_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Step 2: Create stages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages') THEN
    CREATE TABLE stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    RAISE NOTICE '✅ Created stages table';
  ELSE
    RAISE NOTICE 'ℹ️ Stages table already exists';
  END IF;
END $$;

-- Step 3: Insert default stages (with conflict handling)
INSERT INTO stages (name, position) VALUES
  ('Lead', 1),
  ('Qualified', 2),
  ('Proposal', 3),
  ('Negotiation', 4),
  ('Closed Won', 5),
  ('Closed Lost', 6)
ON CONFLICT (name) DO NOTHING;

-- Step 4: Check and fix existing deals with invalid stage_id
DO $$
DECLARE
  invalid_count INTEGER;
  lead_stage_id UUID;
BEGIN
  -- Get the Lead stage ID
  SELECT id INTO lead_stage_id FROM stages WHERE name = 'Lead' LIMIT 1;
  
  -- Count invalid stage_id values
  SELECT COUNT(*) INTO invalid_count
  FROM deals 
  WHERE stage_id IS NOT NULL 
    AND stage_id NOT IN (SELECT id FROM stages);
    
  RAISE NOTICE 'Found % deals with invalid stage_id values', invalid_count;
  
  IF invalid_count > 0 THEN
    -- Update all invalid stage_id values to Lead
    UPDATE deals 
    SET stage_id = lead_stage_id
    WHERE stage_id IS NOT NULL 
      AND stage_id NOT IN (SELECT id FROM stages);
      
    RAISE NOTICE '✅ Fixed % deals with invalid stage_id values', invalid_count;
  END IF;
  
  -- Set NULL stage_id values to Lead as well
  UPDATE deals 
  SET stage_id = lead_stage_id
  WHERE stage_id IS NULL;
  
  RAISE NOTICE '✅ Set default stage for deals with NULL stage_id';
END $$;

-- Step 5: Add stage_id column to deals if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_id') THEN
    ALTER TABLE deals ADD COLUMN stage_id UUID;
    RAISE NOTICE '✅ Added stage_id column to deals table';
  ELSE
    RAISE NOTICE 'ℹ️ stage_id column already exists on deals table';
  END IF;
END $$;

-- Step 6: Now add the foreign key constraint
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals 
    ADD CONSTRAINT fk_deals_stage_id 
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Added foreign key constraint fk_deals_stage_id';
  EXCEPTION 
    WHEN duplicate_object THEN 
      RAISE NOTICE 'ℹ️ Foreign key constraint already exists';
    WHEN OTHERS THEN 
      RAISE NOTICE '❌ Error adding foreign key: %', SQLERRM;
  END;
END $$;

-- Step 7: Verify the fix
SELECT 
  '=== VERIFICATION ===' as info,
  COUNT(*) as total_deals,
  COUNT(stage_id) as deals_with_stage,
  COUNT(CASE WHEN stage_id NOT IN (SELECT id FROM stages) THEN 1 END) as invalid_stages
FROM deals;

-- Show stage distribution
SELECT 
  '=== STAGE DISTRIBUTION ===' as info,
  s.name as stage_name,
  COUNT(d.id) as deal_count
FROM stages s
LEFT JOIN deals d ON s.id = d.stage_id
GROUP BY s.id, s.name, s.position
ORDER BY s.position;

-- Get a valid stage ID for testing
SELECT 
  '=== STAGE ID FOR TESTING ===' as info,
  id as stage_id, 
  name 
FROM stages 
WHERE name = 'Lead';

SELECT '✅ Deals stages foreign key constraint fixed!' as result;