-- Add meeting reference support to coaching preferences
-- Allows users to reference actual recorded meetings as good/bad examples

ALTER TABLE user_coaching_preferences
ADD COLUMN good_example_meeting_ids UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN bad_example_meeting_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Add comment explaining the feature
COMMENT ON COLUMN user_coaching_preferences.good_example_meeting_ids IS 'Array of meeting IDs to use as reference examples of excellent sales technique. AI will analyze these calls and use them as benchmarks.';
COMMENT ON COLUMN user_coaching_preferences.bad_example_meeting_ids IS 'Array of meeting IDs to use as reference examples of techniques to avoid. AI will analyze these calls to identify anti-patterns.';

-- Create helper function to fetch meeting context for coaching
CREATE OR REPLACE FUNCTION get_coaching_reference_meetings(
  p_user_id UUID,
  p_good_meeting_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_bad_meeting_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH good_examples AS (
    SELECT
      id,
      title,
      meeting_start,
      sentiment_score,
      coach_rating,
      LEFT(transcript_text, 500) as transcript_preview
    FROM meetings
    WHERE id = ANY(p_good_meeting_ids)
      AND owner_user_id = p_user_id
      AND transcript_text IS NOT NULL
    ORDER BY coach_rating DESC NULLS LAST
    LIMIT 3
  ),
  bad_examples AS (
    SELECT
      id,
      title,
      meeting_start,
      sentiment_score,
      coach_rating,
      LEFT(transcript_text, 500) as transcript_preview
    FROM meetings
    WHERE id = ANY(p_bad_meeting_ids)
      AND owner_user_id = p_user_id
      AND transcript_text IS NOT NULL
    ORDER BY coach_rating ASC NULLS LAST
    LIMIT 3
  )
  SELECT json_build_object(
    'good_examples', COALESCE((SELECT json_agg(row_to_json(good_examples.*)) FROM good_examples), '[]'::json),
    'bad_examples', COALESCE((SELECT json_agg(row_to_json(bad_examples.*)) FROM bad_examples), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON FUNCTION get_coaching_reference_meetings IS 'Fetches meeting context for AI coaching analysis. Returns previews of transcripts from good and bad example meetings for context.';
