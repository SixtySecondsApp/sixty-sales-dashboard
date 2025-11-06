-- Delete old expired Fathom integration
-- Run this at: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

DELETE FROM fathom_integrations
WHERE id = 'ca77dcdd-bc6a-40c7-9ab5-9058aa8069f8';

-- Verify it's deleted
SELECT COUNT(*) as remaining_integrations
FROM fathom_integrations
WHERE user_id = (
    SELECT id FROM auth.users
    WHERE email = 'andrew.bryce@sixtyseconds.video'
);
