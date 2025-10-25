-- Check if fathom_user_id column exists in meetings table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Check a specific meeting to see what data is missing
SELECT
  id,
  title,
  share_url,
  calls_url,
  transcript_doc_url,
  summary,
  sentiment_score,
  coach_rating,
  coach_summary,
  company_id,
  primary_contact_id
FROM meetings
WHERE id = 'deee8b8c-01f9-44f1-bdc7-663754a65b72';
