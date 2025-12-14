-- Add transcript_text column to meetings table for storing raw transcript
-- This allows for full-text search and analysis without relying on external Google Docs

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- Add index for full-text search on transcript
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_text_search
  ON meetings USING gin(to_tsvector('english', transcript_text));

-- Add comment for documentation
COMMENT ON COLUMN meetings.transcript_text IS
  'Raw plaintext transcript from Fathom API. Used for search and analysis. Google Doc URL still stored in transcript_doc_url.';
