-- Setup script for Google Docs integration database components

-- 1. Create the RPC function to get Google access token
CREATE OR REPLACE FUNCTION get_google_access_token(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_access_token TEXT;
BEGIN
  -- Get the access token from google_integrations table
  SELECT access_token INTO v_access_token
  FROM google_integrations
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1;
  
  RETURN v_access_token;
END;
$$;

-- 2. Create the meeting_documents table (if not exists)
CREATE TABLE IF NOT EXISTS meeting_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id TEXT,
  document_id TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_title TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add RLS policies for meeting_documents
ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own documents
CREATE POLICY "Users can view their own meeting documents" ON meeting_documents
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own documents
CREATE POLICY "Users can insert their own meeting documents" ON meeting_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own documents
CREATE POLICY "Users can update their own meeting documents" ON meeting_documents
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_meeting_documents_user_id ON meeting_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_meeting_id ON meeting_documents(meeting_id);

-- 5. Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_meeting_documents_updated_at ON meeting_documents;
CREATE TRIGGER update_meeting_documents_updated_at
    BEFORE UPDATE ON meeting_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Verify the google_integrations table has the access_token column
-- (This should already exist, but let's make sure)
DO $$
BEGIN
    -- Check if access_token column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'google_integrations' 
        AND column_name = 'access_token'
    ) THEN
        ALTER TABLE google_integrations ADD COLUMN access_token TEXT;
    END IF;
END $$;