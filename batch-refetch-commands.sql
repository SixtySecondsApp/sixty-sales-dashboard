-- Generate curl commands to re-fetch action items for all meetings with 0 items
-- Copy the curl commands from the output and run them in your terminal

SELECT
    ROW_NUMBER() OVER (ORDER BY m.meeting_start DESC) as command_number,
    m.title as meeting_title,
    m.meeting_start,
    m.fathom_recording_id,
    CONCAT(
        'curl -X POST ''https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook'' ',
        '-H ''Authorization: Bearer YOUR_ANON_KEY'' ',
        '-H ''Content-Type: application/json'' ',
        '-d ''{"recording_id": "', m.fathom_recording_id, '", "force_resync": true}'' ',
        '&& echo "✅ ', m.title, ' - Complete"'
    ) as curl_command
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
  AND m.meeting_start >= '2025-10-29'
GROUP BY m.id, m.title, m.meeting_start, m.fathom_recording_id
HAVING COUNT(mai.id) = 0
ORDER BY m.meeting_start DESC;

-- Count how many meetings need re-fetch
SELECT
    'Meetings Needing Re-fetch' as info,
    COUNT(DISTINCT m.id) as count
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
  AND m.meeting_start >= '2025-10-29'
GROUP BY m.id
HAVING COUNT(mai.id) = 0;
