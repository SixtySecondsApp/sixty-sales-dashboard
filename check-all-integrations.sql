-- Check ALL Fathom integrations (not filtered by email)
-- Run this at: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

SELECT
    id,
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at > NOW() as token_valid,
    -- Also show auth.users email for comparison
    (SELECT email FROM auth.users WHERE id = fathom_integrations.user_id) as user_email
FROM fathom_integrations
ORDER BY created_at DESC
LIMIT 10;

-- If you see a row with NULL fathom_user_email but recent created_at,
-- that's your integration! Update it with:
--
-- UPDATE fathom_integrations
-- SET fathom_user_email = 'andrew@sixty.xyz'
-- WHERE user_id = (
--     SELECT id FROM auth.users WHERE email = 'andrew@sixty.xyz'
-- )
-- AND fathom_user_email IS NULL;
