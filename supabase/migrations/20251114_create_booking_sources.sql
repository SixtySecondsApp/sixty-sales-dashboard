-- Create booking_sources table for predefined source options
-- This provides a standardized list of sources that can be mapped to SavvyCal link IDs

CREATE TABLE IF NOT EXISTS booking_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  api_name TEXT NOT NULL UNIQUE, -- API-friendly identifier (e.g., 'facebook_ads', 'linkedin_ads')
  description TEXT,
  category TEXT, -- e.g., 'paid', 'organic', 'referral', 'direct'
  icon TEXT, -- Optional icon name or emoji
  color TEXT, -- Optional color for UI display
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_sources_active ON booking_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_booking_sources_category ON booking_sources(category);
CREATE INDEX IF NOT EXISTS idx_booking_sources_sort_order ON booking_sources(sort_order);
CREATE INDEX IF NOT EXISTS idx_booking_sources_api_name ON booking_sources(api_name) WHERE api_name IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER update_booking_sources_updated_at
  BEFORE UPDATE ON booking_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE booking_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies - booking sources are readable by all authenticated users
CREATE POLICY "Users can view booking sources"
  ON booking_sources FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/service role can manage booking sources
CREATE POLICY "Service role can manage booking sources"
  ON booking_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert predefined sources
INSERT INTO booking_sources (name, api_name, description, category, icon, color, sort_order) VALUES
  ('Facebook Ads', 'facebook_ads', 'Facebook/Meta advertising campaigns', 'paid', '📘', '#1877F2', 1),
  ('LinkedIn Ads', 'linkedin_ads', 'LinkedIn advertising campaigns', 'paid', '💼', '#0077B5', 2),
  ('Google Ads', 'google_ads', 'Google Search and Display advertising', 'paid', '🔍', '#4285F4', 3),
  ('Website', 'website', 'Direct website bookings', 'organic', '🌐', '#4CAF50', 10),
  ('Organic Search', 'organic_search', 'Organic search engine results', 'organic', '🔎', '#34A853', 11),
  ('Referral', 'referral', 'Referrals from existing clients or partners', 'referral', '🤝', '#FF9800', 20),
  ('Email Campaign', 'email_campaign', 'Email marketing campaigns', 'marketing', '📧', '#EA4335', 30),
  ('Content Marketing', 'content_marketing', 'Blog posts, articles, guides', 'organic', '📝', '#9C27B0', 31),
  ('Social Media', 'social_media', 'Organic social media posts', 'organic', '📱', '#E91E63', 32),
  ('Webinar', 'webinar', 'Webinar registrations', 'marketing', '🎥', '#F44336', 33),
  ('Event', 'event', 'In-person or virtual events', 'marketing', '🎪', '#FF5722', 34),
  ('Partner', 'partner', 'Partner referrals or co-marketing', 'referral', '🤝', '#607D8B', 40),
  ('Cold Outreach', 'cold_outreach', 'Outbound sales activities', 'outbound', '📞', '#795548', 50),
  ('Unknown', 'unknown', 'Source not yet identified', 'other', '❓', '#9E9E9E', 99)
ON CONFLICT (name) DO NOTHING;

-- Update savvycal_source_mappings to optionally reference booking_sources
-- Keep source as TEXT for flexibility, but add source_id for reference
DO $$
BEGIN
  -- Add source_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savvycal_source_mappings' 
    AND column_name = 'source_id'
  ) THEN
    ALTER TABLE savvycal_source_mappings 
    ADD COLUMN source_id UUID REFERENCES booking_sources(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_source_id 
    ON savvycal_source_mappings(source_id);
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE booking_sources IS 'Predefined list of booking sources for standardization';
COMMENT ON COLUMN booking_sources.api_name IS 'API-friendly identifier for programmatic access (e.g., "facebook_ads", "linkedin_ads"). Must be unique and stable.';
COMMENT ON COLUMN booking_sources.category IS 'Category grouping: paid, organic, referral, marketing, outbound, other';
COMMENT ON COLUMN savvycal_source_mappings.source_id IS 'Optional reference to predefined booking source';
COMMENT ON COLUMN savvycal_source_mappings.source IS 'Source name (can be custom or match booking_sources.name)';





