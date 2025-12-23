# Auth Users Sync Solution

## Current Status ✅

All data has been successfully synced to development-v2:
- ✅ profiles: 20 records
- ✅ organizations: 10 records
- ✅ contacts: 1,840 records
- ✅ deals: 652 records
- ✅ activities: 6,841 records
- ✅ tasks: 0 records
- ✅ meetings: 1,564 records
- ✅ communication_events: 16 records
- ✅ workflow_executions: 9 records

**Total: 10,952 records synced successfully!**

## ❌ Remaining Issue

**auth.users is empty** - Users cannot log in because there are no user records in the auth schema.

## Why the Supabase Admin API Failed

The `auth.admin.createUser()` API triggers a database trigger that automatically creates a profile when a user is created. Since we already synced profiles (with specific IDs), this causes a primary key conflict and fails with:

```
AuthApiError: Database error creating new user
status: 500
code: "unexpected_failure"
```

## ✅ Solution: Direct SQL Insert

We need to insert users directly into `auth.users` with the same IDs as the existing profiles, bypassing the trigger.

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Development-v2 Dashboard**
   - Project: jczngsvpywgrlgdwzjbr
   - Navigate to SQL Editor

2. **Run the INSERT query**

```sql
-- Step 1: Disable the profile creation trigger temporarily
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- Step 2: Insert users matching existing profiles
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    last_sign_in_at
)
SELECT
    p.id,
    '00000000-0000-0000-0000-000000000000'::uuid as instance_id,
    p.email,
    -- Generate a password hash that will require reset
    crypt('REQUIRES_PASSWORD_RESET', gen_salt('bf')) as encrypted_password,
    NOW() as email_confirmed_at,
    p.created_at,
    p.updated_at,
    'authenticated' as aud,
    'authenticated' as role,
    '' as confirmation_token,
    '' as recovery_token,
    '' as email_change_token_new,
    '{}'::jsonb as raw_app_meta_data,
    jsonb_build_object(
        'full_name', COALESCE(p.full_name, p.email),
        'email', p.email
    ) as raw_user_meta_data,
    false as is_super_admin,
    NULL as last_sign_in_at
FROM profiles p
WHERE p.id NOT IN (SELECT id FROM auth.users);

-- Step 3: Re-enable triggers
ALTER TABLE auth.users ENABLE TRIGGER ALL;

-- Step 4: Verify
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_profiles FROM profiles;
```

3. **Expected Result**

```
✅ 20 users created in auth.users
✅ 20 profiles already exist
✅ All IDs match
```

### Option 2: Using pg_dump/pg_restore (If Database Access Available)

If you have direct PostgreSQL access:

```bash
# Export auth.users from production
pg_dump -h ewtuefzeogytgmsnkpmb.supabase.co -U postgres -t auth.users --data-only -f auth_users.sql

# Import to development-v2
psql -h jczngsvpywgrlgdwzjbr.supabase.co -U postgres -f auth_users.sql
```

## ⚠️ Important: Password Reset Required

Since we cannot copy encrypted passwords from production, users will need to reset their passwords using the "Forgot Password" flow:

1. User goes to login page
2. Clicks "Forgot Password"
3. Enters their email
4. Receives password reset link
5. Sets new password
6. Can now log in

## Post-Sync Verification

After running the INSERT query:

1. **Check user count:**
```sql
SELECT COUNT(*) FROM auth.users;
-- Should return 20
```

2. **Verify ID match:**
```sql
SELECT
    p.id,
    p.email as profile_email,
    u.email as user_email,
    CASE WHEN p.id = u.id THEN '✅ Match' ELSE '❌ Mismatch' END as status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at;
-- All should show '✅ Match'
```

3. **Test login:**
   - Go to development-v2 app
   - Try to log in with your email
   - Use "Forgot Password" to set password
   - Login should work!

## Files Created

- `sync-auth-users.mjs` - Admin API approach (failed due to trigger conflict)
- `sync-auth-direct.mjs` - REST API approach (failed - auth schema not exposed)
- `create-auth-users-from-profiles.sql` - Direct SQL insert solution ✅
- `AUTH_SYNC_SOLUTION.md` - This file

## Timeline

- Step 1 (Run SQL): 1-2 minutes
- Step 2 (Password reset): Per user, 2-3 minutes
- **Total: 3-5 minutes to restore login access**

## Why This Works

1. **Bypasses triggers**: Disabling triggers prevents profile creation conflict
2. **Matches IDs**: Uses the same UUID from profiles table
3. **Email confirmed**: Sets `email_confirmed_at` to skip email verification
4. **Password reset flow**: Users can set their own passwords securely
5. **Re-enables triggers**: Restores normal functionality for future user creation

## Next Steps

1. Run the SQL query in Supabase dashboard
2. Verify 20 users created
3. Test login with password reset
4. Document password reset instructions for all users

✅ This will restore full login functionality to development-v2!
