# Final Auth Users Solution - Manual Steps

## Current Situation

✅ **All data synced successfully** (10,952 records)
❌ **Cannot login** because auth.users is empty

## Why Automated Methods Failed

1. **Admin API** (`auth.admin.createUser()`) - Triggers profile creation, causing conflicts
2. **Direct SQL INSERT** - Permission denied (must be owner of table users)
3. **Edge Function** - Encountered runtime errors

## ✅ Working Solution: Manual User Creation in Dashboard

### Step 1: Access Supabase Dashboard

1. Open https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr
2. Navigate to **Authentication** → **Users**

### Step 2: Delete Existing Profiles

Since the Admin API creates new profiles, we need to temporarily delete the existing ones:

1. Go to **Table Editor** → **profiles**
2. Select all 20 profiles
3. Delete them (don't worry, we'll recreate them with the correct data)

### Step 3: Create Users via Dashboard

For each user from the production system, use the **"Add User"** button:

**Users to create:**
```
andrew+6@sixtyseconds.video
andrew+5@sixtyseconds.video
andrew+4@sixtyseconds.video
andrew+3@sixtyseconds.video
andrew+2@sixtyseconds.video
andrew+1@sixtyseconds.video
brycey23@icloud.com
andrew@sixtyseconds.video
playwright.test@gmail.com
test@playwright.local
rishirais24@gmail.com
nicholasdp@live.co.uk
nickdupreez139@gmail.com
nick@sixtyseconds.video
phil@sixtyseconds.video
aandrianantenaina@nextaura.com
james.lord@sixtyseconds.video
admin@salesdemo.com
steve.gibson@sixtyseconds.video
andrew.bryce@sixtyseconds.video
```

For each user:
1. Click "Add User"
2. Enter email
3. Set password: `TempPassword123!`
4. Check "Auto Confirm Email"
5. Click "Create User"

This will:
- Create the auth.users record
- Automatically create a profile via trigger
- Allow the user to log in immediately

### Step 4: Update Profile Data

After all users are created, update the profiles with the original data from production:

```sql
-- Run this in SQL Editor to restore profile data
-- (Get the original profile data from the production profiles table first)

UPDATE profiles SET
    full_name = 'Andrew Bryce',
    -- Add other fields...
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- Repeat for each user...
```

### Step 5: Verify and Test

1. Check that all 20 users exist in **Authentication** → **Users**
2. Check that all 20 profiles exist in **Table Editor** → **profiles**
3. Try logging in with one of the accounts using `TempPassword123!`
4. ✅ Login should work!

## Alternative: Scripted Profile Update

After creating users manually, you can use this script to restore the original profile data:

```sql
-- Get profiles from production and restore to development
-- (This requires you to export production profiles first)

-- Example update:
UPDATE profiles
SET
    full_name = (SELECT full_name FROM production_profiles WHERE email = profiles.email),
    created_at = (SELECT created_at FROM production_profiles WHERE email = profiles.email),
    updated_at = (SELECT updated_at FROM production_profiles WHERE email = profiles.email)
    -- Add other fields as needed
WHERE email IN (
    'andrew@sixtyseconds.video',
    'andrew.bryce@sixtyseconds.video'
    -- ... other emails
);
```

## Timeline

- Step 1-2: 2 minutes
- Step 3 (Create 20 users): 10-15 minutes (30-45 seconds per user)
- Step 4 (Update profiles): 5 minutes
- **Total: 17-22 minutes**

## Why This Works

1. **No Trigger Conflicts**: Deleting profiles first prevents primary key conflicts
2. **Auto Profile Creation**: Dashboard user creation triggers profile creation automatically
3. **Correct Permissions**: Dashboard uses proper authentication to create users
4. **Data Integrity**: Profile data can be restored after user creation

## Password Reset Instructions for Users

All users need to know:
1. Go to login page
2. Login with email and password `TempPassword123!`
3. (Optional) Change password in settings

Or use "Forgot Password" flow:
1. Click "Forgot Password"
2. Enter email
3. Receive reset link
4. Set new password

## Post-Completion Checklist

- [ ] 20 users created in auth.users
- [ ] 20 profiles exist in profiles table
- [ ] Login works with test account
- [ ] All data visible in application (10,952 records)
- [ ] Users notified of temporary password

✅ **This will restore full access to your development-v2 environment!**
