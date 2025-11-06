-- Check Fathom Integration Status
-- Run this in Supabase SQL Editor

-- 1. Check if integration exists and is active
SELECT
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    updated_at,
    token_expires_at,
    CASE
        WHEN token_expires_at < NOW() THEN '❌ EXPIRED'
        WHEN token_expires_at < NOW() + INTERVAL '1 day' THEN '⚠️  EXPIRES SOON'
        ELSE '✅ VALID'
    END as token_status
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';

-- 2. Check recent meetings synced
SELECT
    COUNT(*) as total_meetings,
    MAX(meeting_start) as latest_meeting,
    MAX(last_synced_at) as last_sync
FROM meetings
WHERE owner_email = 'andrew@sixty.xyz';

-- 3. Check last sync state
SELECT
    sync_status,
    last_sync_started_at,
    last_sync_completed_at,
    meetings_synced,
    total_meetings_found,
    last_sync_error
FROM fathom_sync_state
WHERE user_id = (
    SELECT user_id FROM fathom_integrations
    WHERE fathom_user_email = 'andrew@sixty.xyz'
    LIMIT 1
);

-- 4. Check for any recent meetings from today
SELECT
    id,
    title,
    meeting_start,
    owner_email,
    fathom_recording_id,
    sync_status,
    last_synced_at
FROM meetings
WHERE owner_email = 'andrew@sixty.xyz'
    AND meeting_start >= CURRENT_DATE
ORDER BY meeting_start DESC
LIMIT 10;
