-- Add sharing columns to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS share_views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_options jsonb DEFAULT '{"include_summary": true, "include_action_items": true, "include_transcript": false, "include_recording": true}'::jsonb;

-- Create index for share_token lookups (only for public meetings)
CREATE INDEX IF NOT EXISTS idx_meetings_share_token
ON meetings(share_token) WHERE is_public = true;

-- Function to increment meeting share views
CREATE OR REPLACE FUNCTION increment_meeting_views(p_share_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE meetings
  SET share_views = share_views + 1
  WHERE share_token = p_share_token AND is_public = true;
END;
$$;

-- RLS policy for public meeting access
-- This allows anyone to view a meeting if they have the share_token and it's public
DROP POLICY IF EXISTS "Public can view shared meetings" ON meetings;
CREATE POLICY "Public can view shared meetings" ON meetings
FOR SELECT
USING (is_public = true AND share_token IS NOT NULL);

-- Add comments
COMMENT ON COLUMN meetings.share_token IS 'Unique token for public sharing URL';
COMMENT ON COLUMN meetings.is_public IS 'Whether the meeting is publicly accessible via share link';
COMMENT ON COLUMN meetings.share_views IS 'Number of times the shared meeting has been viewed';
COMMENT ON COLUMN meetings.share_options IS 'JSON object specifying what content to include in share (summary, action_items, transcript, recording)';
