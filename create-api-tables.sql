-- Create api_requests table for tracking API request history
CREATE TABLE IF NOT EXISTS api_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  endpoint TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  body JSONB,
  status INTEGER,
  response JSONB,
  response_time INTEGER, -- in milliseconds
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_api_requests_user_id ON api_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_api_key_id ON api_requests(api_key_id);

-- Enable RLS
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own API requests" ON api_requests;
DROP POLICY IF EXISTS "Users can create their own API requests" ON api_requests;
DROP POLICY IF EXISTS "Users can update their own API requests" ON api_requests;
DROP POLICY IF EXISTS "Users can delete their own API requests" ON api_requests;

-- Create RLS policies
CREATE POLICY "Users can view their own API requests"
  ON api_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API requests"
  ON api_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API requests"
  ON api_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API requests"
  ON api_requests FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON api_requests TO authenticated;
GRANT ALL ON api_requests TO service_role;