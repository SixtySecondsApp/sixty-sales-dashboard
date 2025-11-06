-- Update the fathom_user_email field for the new integration
-- Run this at: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

UPDATE fathom_integrations
SET fathom_user_email = 'andrew.bryce@sixtyseconds.video'
WHERE id = '222bad94-84f7-4970-bcd1-f6b489cd7c08';

-- Verify the update
SELECT
    id,
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at > NOW() as token_valid
FROM fathom_integrations
WHERE id = '222bad94-84f7-4970-bcd1-f6b489cd7c08';
