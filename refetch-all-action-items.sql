-- Re-fetch Action Items from Fathom API for All Meetings
-- Purpose: Call the Fathom webhook for each meeting to populate action items
-- Date: 2025-01-06
--
-- This script uses Supabase's HTTP extension to call the fathom-webhook edge function
-- for each meeting that has a Fathom recording ID.

-- ========================================
-- STEP 1: Check which meetings need action items
-- ========================================

SELECT
    'Current State' as step,
    m.id,
    m.title,
    m.fathom_recording_id,
    m.meeting_start,
    COUNT(mai.id) as current_action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id, m.title, m.fathom_recording_id, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 20;

-- ========================================
-- STEP 2: Summary of meetings without action items
-- ========================================

SELECT
    'Meetings Without Action Items' as summary,
    COUNT(DISTINCT m.id) as count
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id
HAVING COUNT(mai.id) = 0;

-- ========================================
-- INSTRUCTIONS TO RE-FETCH ACTION ITEMS
-- ========================================

/*
OPTION 1: Use Supabase Dashboard (EASIEST)
------------------------------------------
1. Go to Supabase Dashboard → Edge Functions
2. Find "fathom-webhook" function
3. Click "Invoke" button
4. For each meeting from STEP 1 above, send this payload:
   {
     "recording_id": "PASTE_FATHOM_RECORDING_ID_HERE",
     "force_resync": true
   }
5. Repeat for each meeting that needs action items

OPTION 2: Use curl commands (AUTOMATED)
----------------------------------------
You can use the curl commands generated below.
Replace YOUR_ANON_KEY with your Supabase anon key from your .env file.

Run this query to generate curl commands:
*/

SELECT
    m.title as meeting_title,
    m.fathom_recording_id,
    COUNT(mai.id) as current_action_items,
    CONCAT(
        'curl -X POST ''https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook'' ',
        '-H ''Authorization: Bearer YOUR_ANON_KEY'' ',
        '-H ''Content-Type: application/json'' ',
        '-d ''{"recording_id": "', m.fathom_recording_id, '", "force_resync": true}'''
    ) as curl_command
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id, m.title, m.fathom_recording_id
HAVING COUNT(mai.id) = 0  -- Only meetings without action items
ORDER BY m.meeting_start DESC;

-- ========================================
-- STEP 3: After running webhook calls, verify action items were created
-- ========================================

/*
After calling the webhook for each meeting, run this verification query:
*/

SELECT
    'Verification After Re-fetch' as step,
    m.title as meeting_title,
    m.meeting_start,
    COUNT(mai.id) as action_items_count,
    STRING_AGG(mai.title, '; ') as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id, m.title, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 20;

-- ========================================
-- NOTES
-- ========================================

/*
The fathom-webhook edge function will:
1. Call Fathom's API to get meeting details
2. Extract action items from the meeting
3. Store them in the meeting_action_items table
4. NOT automatically create tasks (automatic syncing is disabled)

After action items are fetched:
1. Go to the meeting detail page in your app
2. Review the action items
3. Click "Add to Tasks" for items you want to track
4. This creates tasks manually on a meeting-by-meeting basis

Edge function location:
- supabase/functions/fathom-webhook/index.ts

Webhook expects payload:
{
  "recording_id": "fathom_recording_id_from_meetings_table",
  "force_resync": true
}
*/
