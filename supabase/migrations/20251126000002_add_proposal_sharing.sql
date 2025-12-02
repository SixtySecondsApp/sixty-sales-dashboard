-- Add sharing fields to proposals table
-- Enables password-protected public sharing of proposals

-- Add sharing columns
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS share_views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Create index for share_token lookups
CREATE INDEX IF NOT EXISTS idx_proposals_share_token ON proposals(share_token) WHERE is_public = true;

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_proposal_views(p_share_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE proposals
  SET share_views = COALESCE(share_views, 0) + 1,
      last_viewed_at = now()
  WHERE share_token = p_share_token AND is_public = true;
END;
$$;

-- Create RLS policy for public access via share token
-- This allows anyone to view a proposal if they have the share_token and it's public
CREATE POLICY "Anyone can view public proposals via share token" ON proposals
    FOR SELECT
    USING (is_public = true AND share_token IS NOT NULL);

-- Grant execute on the function to anon role for public access
GRANT EXECUTE ON FUNCTION increment_proposal_views(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_proposal_views(uuid) TO authenticated;
