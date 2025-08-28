-- Create stages table if it doesn't exist
CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
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

-- Make stage_id NOT NULL with a default
ALTER TABLE deals 
ALTER COLUMN stage_id SET DEFAULT (SELECT id FROM stages WHERE name = 'Lead' LIMIT 1);

-- Add foreign key if missing
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_stage_id 
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; 
  END;
END $$;

-- Get a valid stage_id for testing
SELECT 
  '=== VALID STAGE ID FOR TESTING ===' as info,
  id as stage_id, 
  name 
FROM stages 
WHERE name = 'Lead';

SELECT '✅ Stages table created and configured!' as result;