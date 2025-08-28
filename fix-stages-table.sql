-- Fix stages table and add default stages

-- First check if stages table exists
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

-- Insert default stages (now ON CONFLICT will work)
INSERT INTO stages (name, position) VALUES
  ('Lead', 1),
  ('Qualified', 2),
  ('Proposal', 3),
  ('Negotiation', 4),
  ('Closed Won', 5),
  ('Closed Lost', 6)
ON CONFLICT (name) DO NOTHING;

-- Add stage_id to deals if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_id') THEN
    ALTER TABLE deals ADD COLUMN stage_id UUID;
  END IF;
END $$;

-- Set a default stage for existing deals
UPDATE deals 
SET stage_id = (SELECT id FROM stages WHERE name = 'Lead' LIMIT 1) 
WHERE stage_id IS NULL;

-- Add foreign key if missing
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_stage_id 
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; 
  END;
END $$;

-- Get the Lead stage ID for testing
SELECT 
  '=== STAGE ID FOR TESTING ===' as info,
  id as stage_id, 
  name 
FROM stages 
WHERE name = 'Lead';

-- Show all stages
SELECT '=== ALL STAGES ===' as info;
SELECT id, name, position FROM stages ORDER BY position;

SELECT '✅ Stages table fixed and configured!' as result;