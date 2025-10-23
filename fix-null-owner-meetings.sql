-- Fix meetings with NULL owner_user_id
-- This will assign orphaned meetings to the current user

-- First, let's see how many meetings have NULL owner_user_id
SELECT 
    'Meetings with NULL owner' as check_type,
    COUNT(*) as count
FROM meetings
WHERE owner_user_id IS NULL;

-- Update meetings with NULL owner_user_id to assign them to Andrew Bryce
UPDATE meetings
SET owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
WHERE owner_user_id IS NULL;

-- Verify the update
SELECT 
    'After Update - NULL owners' as check_type,
    COUNT(*) as count
FROM meetings
WHERE owner_user_id IS NULL;

-- Show all meetings now owned by the user
SELECT 
    'User Meetings After Fix' as check_type,
    id,
    title,
    owner_user_id,
    meeting_start,
    duration_minutes
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
ORDER BY meeting_start DESC
LIMIT 10;