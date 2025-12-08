-- Fix Corrupted Duration Data in Meetings Table
-- Run this in Supabase Dashboard > SQL Editor
-- This identifies and fixes meetings with impossibly long durations

-- 1. First, identify corrupted records (durations > 8 hours = 480 minutes)
SELECT
  id,
  title,
  duration_minutes,
  meeting_start,
  meeting_end,
  fathom_recording_id
FROM meetings
WHERE duration_minutes > 480
ORDER BY duration_minutes DESC;

-- 2. Recalculate duration from meeting_start/meeting_end where possible
UPDATE meetings
SET duration_minutes = CASE
  WHEN meeting_start IS NOT NULL AND meeting_end IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (meeting_end - meeting_start)) / 60)
  ELSE NULL
END,
updated_at = NOW()
WHERE duration_minutes > 480
  AND meeting_start IS NOT NULL
  AND meeting_end IS NOT NULL;

-- 3. For meetings still with bad data (or no start/end times), set to NULL
-- This allows the UI to show "—" instead of incorrect values
UPDATE meetings
SET duration_minutes = NULL,
    updated_at = NOW()
WHERE duration_minutes > 480;

-- 4. Verify the fix
SELECT
  COUNT(*) as total_meetings,
  COUNT(CASE WHEN duration_minutes > 480 THEN 1 END) as still_corrupted,
  COUNT(CASE WHEN duration_minutes IS NULL THEN 1 END) as null_durations,
  ROUND(AVG(duration_minutes) FILTER (WHERE duration_minutes IS NOT NULL AND duration_minutes <= 480), 1) as avg_valid_duration
FROM meetings;
