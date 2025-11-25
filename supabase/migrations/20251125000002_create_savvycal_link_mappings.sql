-- Create SavvyCal link mappings table
-- Maps SavvyCal link_ids to human-readable source names and default channels

--------------------------------------------------------------------------------
-- savvycal_link_mappings: Map link_ids to source information
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savvycal_link_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'direct',
  medium TEXT,
  description TEXT,
  default_owner_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_savvycal_link_mappings_link_id ON savvycal_link_mappings(link_id);
CREATE INDEX IF NOT EXISTS idx_savvycal_link_mappings_active ON savvycal_link_mappings(is_active) WHERE is_active = true;

-- Add updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_savvycal_link_mappings_updated_at'
  ) THEN
    CREATE TRIGGER update_savvycal_link_mappings_updated_at
      BEFORE UPDATE ON savvycal_link_mappings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE savvycal_link_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - readable by authenticated users, manageable by admins
CREATE POLICY "SavvyCal links readable to authenticated users"
  ON savvycal_link_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "SavvyCal links manageable by admins"
  ON savvycal_link_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "SavvyCal links manageable by service role"
  ON savvycal_link_mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

--------------------------------------------------------------------------------
-- Populate with known link mappings from historical data analysis
--------------------------------------------------------------------------------
INSERT INTO savvycal_link_mappings (link_id, source_name, channel, medium, description) VALUES
  -- High volume links (analyzed from CSV)
  ('link_01JBH7K597B546RDY6VW39RFCK', 'LinkedIn Ads', 'paid_social', 'linkedin', 'Main LinkedIn Ads campaign link - 573 leads (188 with UTM, 384 organic traffic on paid link) - Cold Audience Recruitment & Real Estate'),
  ('link_01HFP52WV5SNC0QJ64PMS5QZKX', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link - 432 leads'),
  ('link_01JBKF8K31JXM7E4SWCAJZ41Z1', 'Meta Ads', 'paid_social', 'meta', 'Facebook/Instagram Ads campaign link - 79 leads'),
  ('link_01FTR1GZYM6QY85JN1EWCS9Y8E', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link - Let''s Chat'),
  ('link_01HPKR8B7SHF2STE79NECDSK66', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link - Let''s Chat'),
  ('link_01FYEG9546WCQ1Q6SBRQV43JJC', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01G546GHBJD033660AV798D5FY', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01GD0S755ZP7GT9XQQ9VTFDN8W', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01JT0ASXXM4PD990TNX9JYHPJ4', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01JBH1NEAYNQ6AM1P9YMZ8H78W', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01FTC1C28476C3XD3670E2KP05', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01J3N4GV2F4EH4JH0BHTNKH2JN', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01J3N1BH10BKSQRDQT6RVCP107', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01JHJ4GKHTJ7P0BVZBFHVQ4EBP', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01HQ0S2MAPMYDV0QKJ20HT50JX', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01FX7S962J2DKJ1QRYAET23P0N', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link'),
  ('link_01JKQM3N0NKHXABA5P67KXN3A9', 'Personal Calendar', 'direct', 'calendaring', 'Personal scheduling link')
ON CONFLICT (link_id) DO NOTHING;

COMMENT ON TABLE savvycal_link_mappings IS 'Maps SavvyCal scheduling link IDs to human-readable source names and channels';
COMMENT ON COLUMN savvycal_link_mappings.link_id IS 'SavvyCal link identifier (e.g., link_01JBH7K597B546RDY6VW39RFCK)';
COMMENT ON COLUMN savvycal_link_mappings.source_name IS 'Human-readable source name for display';
COMMENT ON COLUMN savvycal_link_mappings.channel IS 'Marketing channel (paid_social, direct, organic, email, etc.)';
COMMENT ON COLUMN savvycal_link_mappings.medium IS 'UTM medium equivalent (linkedin, meta, calendaring, etc.)';
