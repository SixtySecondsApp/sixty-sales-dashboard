-- Re-fetch Action Items from Fathom API
-- Purpose: Call the Fathom sync function to reload action items from Fathom's API
-- Date: 2025-01-06
--
-- This script triggers the existing Fathom sync edge function for each meeting
-- The edge function will call Fathom's API and populate action items

-- ========================================
-- STEP 1: Get list of meetings that need action items re-synced
-- ========================================

SELECT
    'Meetings Needing Sync' as step,
    m.id,
    m.title,
    m.fathom_recording_id,
    m.meeting_start,
    COUNT(mai.id) as current_action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
GROUP BY m.id, m.title, m.fathom_recording_id, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 50;

-- ========================================
-- INSTRUCTIONS TO RE-SYNC FROM FATHOM
-- ========================================

-- Option 1: Use the Fathom webhook edge function
-- For each meeting, you can manually trigger a re-sync by calling:
--
-- POST https://YOUR_PROJECT.supabase.co/functions/v1/fathom-webhook
-- Headers:
--   Authorization: Bearer YOUR_ANON_KEY
--   Content-Type: application/json
-- Body:
--   {
--     "recording_id": "FATHOM_RECORDING_ID",
--     "action": "resync"
--   }

-- Option 2: Use the Fathom sync edge function
-- This is likely available at:
-- POST https://YOUR_PROJECT.supabase.co/functions/v1/fathom-sync

-- Option 3: Batch re-sync (if you have many meetings)
-- You can create a simple script that loops through meetings and calls the edge function

-- ========================================
-- VERIFICATION AFTER RE-SYNC
-- ========================================

-- Run this after triggering the re-sync to verify action items were created:
SELECT
    'Verification' as step,
    m.title as meeting_title,
    m.meeting_start,
    COUNT(mai.id) as action_items_count,
    STRING_AGG(mai.title, '; ') as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
GROUP BY m.id, m.title, m.meeting_start
HAVING COUNT(mai.id) > 0
ORDER BY m.meeting_start DESC
LIMIT 20;

-- ========================================
-- NOTES
-- ========================================

/*
The edge functions for Fathom sync are located at:
- supabase/functions/fathom-webhook/index.ts
- supabase/functions/fathom-sync/index.ts
- supabase/functions/extract-action-items/index.ts

These functions:
1. Call Fathom's API to get meeting details
2. Extract action items from the meeting
3. Store them in meeting_action_items table
4. Do NOT automatically create tasks (that was disabled)

To manually trigger a re-sync, you can:
1. Use the Supabase dashboard -> Edge Functions
2. Call the function with the meeting's fathom_recording_id
3. The function will fetch fresh data from Fathom

Alternatively, if you have a Fathom webhook configured, you can:
1. Go to Fathom dashboard
2. Re-trigger the webhook for specific meetings
3. This will automatically call your edge function
*/
