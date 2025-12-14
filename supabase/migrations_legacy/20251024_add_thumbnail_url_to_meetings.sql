-- Add thumbnail_url to meetings for Fathom recording previews
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Optional helpful index for feeds/cards rendering by recent updates
CREATE INDEX IF NOT EXISTS idx_meetings_thumbnail_updated
  ON meetings(updated_at)
  WHERE thumbnail_url IS NOT NULL;

COMMENT ON COLUMN meetings.thumbnail_url IS 'Cached thumbnail image for the Fathom recording (from share page og:image)';


