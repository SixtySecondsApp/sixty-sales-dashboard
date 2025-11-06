-- Verify Fathom Integration
SELECT
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at,
    CASE
        WHEN token_expires_at < NOW() THEN '❌ EXPIRED'
        WHEN token_expires_at < NOW() + INTERVAL '1 day' THEN '⚠️  EXPIRES SOON'
        ELSE '✅ VALID'
    END as token_status
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';
