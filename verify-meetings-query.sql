-- Debug why meetings aren't showing in the UI

-- 1. Check total meetings in database
SELECT 
    'Total Meetings in DB' as check_type,
    COUNT(*) as count
FROM meetings;

-- 2. Check meetings for the specific user
SELECT 
    'Meetings for Andrew' as check_type,
    COUNT(*) as count
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- 3. Check if there's an issue with the companies join
SELECT 
    'Meetings with Company Info' as check_type,
    m.id,
    m.title,
    m.owner_user_id,
    m.meeting_start,
    c.name as company_name
FROM meetings m
LEFT JOIN companies c ON m.company_id = c.id
WHERE m.owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
LIMIT 5;

-- 4. Check meeting_action_items join
SELECT 
    'Meetings with Action Items' as check_type,
    m.id,
    m.title,
    COUNT(mai.id) as action_item_count
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
GROUP BY m.id, m.title
LIMIT 5;

-- 5. Test the exact query the component uses
SELECT 
    'Component Query Test' as check_type,
    COUNT(*) as count
FROM meetings m
LEFT JOIN companies c ON m.company_id = c.id
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- 6. Check if any meetings are visible without owner filter
SELECT 
    'All Meetings (No Filter)' as check_type,
    id,
    title,
    owner_user_id,
    meeting_start
FROM meetings
ORDER BY meeting_start DESC NULLS LAST
LIMIT 5;