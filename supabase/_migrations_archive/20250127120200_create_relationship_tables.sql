/*
  # Create CRM Relationship Tables
  
  1. New Tables
    - `deal_contacts` (many-to-many relationship between deals and contacts)
    - `contact_preferences` (communication preferences for contacts) 
    - `activity_sync_rules` (rules for intelligent activity automation)
    
  2. Note: Works with existing tables and profiles instead of auth.users
*/

-- Create deal_contacts relationship table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'stakeholder' CHECK (role IN ('decision_maker', 'influencer', 'stakeholder', 'champion', 'blocker')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deal_id, contact_id) -- Prevent duplicate relationships
);

-- Create contact_preferences table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS contact_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  preferred_method TEXT DEFAULT 'email' CHECK (preferred_method IN ('email', 'phone', 'linkedin', 'text')),
  timezone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contact_id) -- One preference record per contact
);

-- Create activity_sync_rules table for intelligent automation
CREATE TABLE IF NOT EXISTS activity_sync_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('sale', 'outbound', 'meeting', 'proposal')),
  min_priority TEXT DEFAULT 'medium' CHECK (min_priority IN ('low', 'medium', 'high')),
  auto_create_deal BOOLEAN DEFAULT false,
  target_stage_name TEXT, -- Maps to deal_stages.name
  owner_id UUID REFERENCES profiles(id) NOT NULL, -- Use profiles instead of auth.users
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(activity_type, owner_id) -- One rule per activity type per user
);

-- Create indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id ON deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact_id ON deal_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_role ON deal_contacts(role);

CREATE INDEX IF NOT EXISTS idx_contact_preferences_contact_id ON contact_preferences(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_preferences_method ON contact_preferences(preferred_method);

CREATE INDEX IF NOT EXISTS idx_activity_sync_rules_owner_id ON activity_sync_rules(owner_id);
CREATE INDEX IF NOT EXISTS idx_activity_sync_rules_activity_type ON activity_sync_rules(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_sync_rules_active ON activity_sync_rules(is_active) WHERE is_active = true;

-- Create updated_at triggers (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_contact_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_contact_preferences_updated_at BEFORE UPDATE ON contact_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_activity_sync_rules_updated_at'
  ) THEN
    CREATE TRIGGER update_activity_sync_rules_updated_at BEFORE UPDATE ON activity_sync_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 