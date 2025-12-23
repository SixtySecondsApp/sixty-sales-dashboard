# 🔍 Check Integration - All Users

The OAuth callback shows a warning but it may have still saved the integration!

The error was just trying to get your Fathom email, which is non-critical.

## Run This SQL Query

```sql
-- Check ALL integrations (not filtered by email)
SELECT 
    id,
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at > NOW() as token_valid
FROM fathom_integrations
ORDER BY created_at DESC
LIMIT 10;
```

Run at: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

## What to Look For

**If you see rows**:
- Check if `created_at` is recent (from today)
- Check if `is_active = true`
- Check if `token_valid = true`
- The `fathom_user_email` might be NULL (that's OK!)

**If recent row exists** → Integration IS saved, just without email!

## Next Step If Integration Exists

Update the email manually:

```sql
-- Update the integration to add your email
UPDATE fathom_integrations
SET fathom_user_email = 'andrew@sixty.xyz'
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'andrew@sixty.xyz'
)
AND fathom_user_email IS NULL;
```

Then test the webhook again!
