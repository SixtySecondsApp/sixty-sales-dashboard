-- Check which meetings have Fathom recording IDs
-- This tells us which meetings CAN be re-fetched from Fathom

SELECT
    m.title as meeting_title,
    m.meeting_start,
    m.fathom_recording_id,
    CASE
        WHEN m.fathom_recording_id IS NOT NULL THEN '✅ Has Recording ID'
        ELSE '❌ No Recording ID'
    END as fathom_status,
    COUNT(mai.id) as current_action_items,
    CASE
        WHEN m.fathom_recording_id IS NOT NULL AND COUNT(mai.id) = 0 THEN '🔄 Can Re-fetch'
        WHEN m.fathom_recording_id IS NOT NULL AND COUNT(mai.id) > 0 THEN '✅ Already Has Items'
        WHEN m.fathom_recording_id IS NULL THEN '⚠️ Not Fathom Meeting'
        ELSE '❓ Unknown'
    END as recommendation
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.meeting_start >= '2025-10-29'  -- Last ~10 days
GROUP BY m.id, m.title, m.meeting_start, m.fathom_recording_id
ORDER BY m.meeting_start DESC;

-- Summary stats
SELECT
    '📊 Summary' as summary,
    COUNT(*) FILTER (WHERE fathom_recording_id IS NOT NULL) as has_fathom_id,
    COUNT(*) FILTER (WHERE fathom_recording_id IS NULL) as no_fathom_id,
    COUNT(*) as total_meetings
FROM meetings
WHERE meeting_start >= '2025-10-29';
