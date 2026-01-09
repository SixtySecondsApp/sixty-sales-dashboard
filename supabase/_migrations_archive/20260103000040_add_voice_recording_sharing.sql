-- Migration: Add sharing fields to voice_recordings table
-- Enables public sharing of voice recordings via shareable link

-- Add sharing columns
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS share_views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Create index for share_token lookups (only for public recordings)
CREATE INDEX IF NOT EXISTS idx_voice_recordings_share_token
ON voice_recordings(share_token) WHERE is_public = true;

-- Create a function to increment view count for voice recordings
CREATE OR REPLACE FUNCTION increment_voice_recording_views(p_share_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE voice_recordings
  SET share_views = COALESCE(share_views, 0) + 1,
      last_viewed_at = now()
  WHERE share_token = p_share_token AND is_public = true;
END;
$$;

-- Create RLS policy for public access via share token
-- This allows anyone to view a voice recording if they have the share_token and it's public
CREATE POLICY "Anyone can view public voice recordings via share token"
ON voice_recordings
FOR SELECT
USING (is_public = true AND share_token IS NOT NULL);

-- Grant execute on the function to anon role for public access
GRANT EXECUTE ON FUNCTION increment_voice_recording_views(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_voice_recording_views(uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN voice_recordings.share_token IS 'Unique token for public sharing URL';
COMMENT ON COLUMN voice_recordings.is_public IS 'Whether the recording is publicly accessible via share link';
COMMENT ON COLUMN voice_recordings.share_views IS 'Number of times the public link has been viewed';
COMMENT ON COLUMN voice_recordings.last_viewed_at IS 'Timestamp of last public view';
