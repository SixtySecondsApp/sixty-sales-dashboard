-- Fix existing deals with invalid stage_id values

-- First create stages table
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
  END IF;
END $$;

-- Add unique constraint if missing
DO $$
BEGIN
  BEGIN
    ALTER TABLE stages ADD CONSTRAINT stages_name_key UNIQUE (name);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Insert default stages
INSERT INTO stages (name, position) VALUES
  ('Lead', 1),
  ('Qualified', 2),
  ('Proposal', 3),
  ('Negotiation', 4),
  ('Closed Won', 5),
  ('Closed Lost', 6)
ON CONFLICT (name) DO NOTHING;

-- Fix all existing deals with invalid or NULL stage_id (next step)

-- Fix all existing deals with invalid or NULL stage_id
UPDATE deals 
SET stage_id = (SELECT id FROM stages WHERE name = 'Lead' LIMIT 1)
WHERE stage_id IS NULL 
   OR stage_id NOT IN (SELECT id FROM stages);

-- Now add the foreign key constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  BEGIN
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS fk_deals_stage_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Add the constraint
  ALTER TABLE deals ADD CONSTRAINT fk_deals_stage_id 
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
  
  RAISE NOTICE '✅ Added foreign key constraint';
END $$;

-- Show the Lead stage ID for reference
SELECT 
  '=== STAGE ID FOR TESTING ===' as info,
  id as stage_id, 
  name 
FROM stages 
WHERE name = 'Lead';

SELECT '✅ Deals stages fixed!' as result;