/*
  # Enhance Existing Contacts Table
  
  1. Updates to existing contacts table
    - Add `company_id` foreign key to companies
    - Add `title` for job title
    - Add `linkedin_url` for LinkedIn profiles  
    - Add `is_primary` to mark primary contact for company
    - Add `owner_id` to link to profiles
    - Add `full_name` computed column
    
  2. Note: Preserves all existing 348 contacts
*/

-- Add missing columns to existing contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS title TEXT, -- Job title
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false, -- Primary contact for company
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Add full_name computed column if it doesn't exist (using immutable functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE contacts 
    ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
      CASE 
        WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 
          first_name || ' ' || last_name
        WHEN first_name IS NOT NULL THEN first_name
        WHEN last_name IS NOT NULL THEN last_name
        ELSE NULL
      END
    ) STORED;
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON contacts(is_primary) WHERE is_primary = true;

-- Update trigger for contacts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to ensure only one primary contact per company per user
CREATE OR REPLACE FUNCTION check_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a contact as primary, remove primary status from other contacts for same company
  IF NEW.is_primary = true AND NEW.company_id IS NOT NULL THEN
    UPDATE contacts 
    SET is_primary = false 
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND (owner_id = NEW.owner_id OR (owner_id IS NULL AND NEW.owner_id IS NULL));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for primary contact enforcement
DROP TRIGGER IF EXISTS ensure_single_primary_contact ON contacts;
CREATE TRIGGER ensure_single_primary_contact 
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION check_primary_contact(); 