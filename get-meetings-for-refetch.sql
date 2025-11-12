-- Get list of meetings that need action items re-fetched from Fathom
-- This generates the data you need to call the fathom-webhook edge function

SELECT
    'Meeting Info for Re-fetch' as info,
    m.id,
    m.fathom_recording_id,
    m.title,
    m.share_url,
    m.meeting_start,
    COUNT(mai.id) as current_action_items,
    -- Generate the curl command to call the webhook
    CONCAT(
        'curl -X POST ''https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook'' ',
        '-H ''Authorization: Bearer YOUR_ANON_KEY'' ',
        '-H ''Content-Type: application/json'' ',
        '-d ''{"recording_id": "', m.fathom_recording_id, '", "force_resync": true}'''
    ) as curl_command
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id, m.fathom_recording_id, m.title, m.share_url, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 20;

-- Summary: Meetings without action items
SELECT
    'Meetings Needing Action Items' as summary,
    COUNT(*) as meetings_without_action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id
HAVING COUNT(mai.id) = 0;
