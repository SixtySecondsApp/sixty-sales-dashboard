-- Check which meetings should have action items based on Fathom share URLs

-- Meeting 1: Should have 3 action items
-- https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz
SELECT
  id,
  title,
  fathom_recording_id,
  share_url,
  '3 expected' as action_items_expected
FROM meetings
WHERE share_url = 'https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz'

UNION ALL

-- Meeting 2: Should have 2 action items
-- https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf
SELECT
  id,
  title,
  fathom_recording_id,
  share_url,
  '2 expected' as action_items_expected
FROM meetings
WHERE share_url = 'https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf';

-- Check if any action items exist for these meetings
SELECT
  m.title,
  m.fathom_recording_id,
  COUNT(mai.id) as actual_action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.share_url IN (
  'https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz',
  'https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf'
)
GROUP BY m.id, m.title, m.fathom_recording_id;
