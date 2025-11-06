-- Verify the email was updated correctly
SELECT
    id,
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at > NOW() as token_valid
FROM fathom_integrations
WHERE id = '222bad94-84f7-4970-bcd1-f6b489cd7c08';
