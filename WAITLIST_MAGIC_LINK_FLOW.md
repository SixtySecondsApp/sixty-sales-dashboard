# Waitlist Magic Link Flow - Complete Implementation

## Overview
This document describes the complete flow for waitlist users clicking magic links to create accounts and access the dashboard.

## Flow Diagram

```
1. Admin grants access
   ↓
2. Magic link generated via signInWithOtp
   ↓
3. Email sent with magic link
   ↓
4. User clicks magic link
   ↓
5. Supabase creates user (if doesn't exist) - passwordless
   ↓
6. Triggers fire:
   - handle_new_user() → Creates profile
   - auto_create_org_for_new_user() → Creates org + membership (dashboard access)
   - link_user_to_waitlist() → Links waitlist entry to user
   ↓
7. Redirect to /auth/callback?waitlist_entry={id}
   ↓
8. AuthCallback verifies session
   ↓
9. Redirect to /auth/set-password?waitlist_entry={id}
   ↓
10. SetPassword page:
    - Verifies session
    - User sets password
    - Updates profile with waitlist entry data (name)
    - Ensures waitlist entry is linked (safety check)
    - Creates onboarding progress record
   ↓
11. Redirect to /dashboard
   ↓
12. User has full access!
```

## Key Components

### 1. Magic Link Generation
**File:** `src/lib/services/waitlistAdminService.ts`
- Uses `signInWithOtp()` to generate magic links
- Redirect URL: `/auth/callback?waitlist_entry={entryId}`
- Automatically creates user if they don't exist (passwordless)

### 2. Auth Callback Handler
**File:** `src/pages/auth/AuthCallback.tsx`
- Handles OTP verification from magic link
- Detects `waitlist_entry` parameter
- Redirects to SetPassword page for waitlist users

### 3. Set Password Page
**File:** `src/pages/auth/SetPassword.tsx`
- Shows welcome message for Early Access
- Allows user to set password (required for future logins)
- Updates profile with waitlist entry data (name)
- Ensures waitlist entry is linked (manual fallback if trigger didn't fire)
- Creates onboarding progress record
- Redirects to dashboard

### 4. Database Triggers
**File:** `supabase/migrations/20251130000003_enhance_waitlist_for_access.sql`

- `handle_new_user()` - Creates profile when auth user is created
- `auto_create_org_for_new_user()` - Creates organization and membership (grants dashboard access)
- `link_user_to_waitlist()` - Links user to waitlist entry by email match

## Testing Checklist

### Test Case 1: New User - Magic Link Click
1. ✅ Admin grants access to waitlist entry
2. ✅ Magic link is generated and sent
3. ✅ User clicks magic link in email
4. ✅ User is created automatically (passwordless)
5. ✅ Profile is created with email
6. ✅ Organization is created (user is owner)
7. ✅ Waitlist entry is linked to user
8. ✅ User is redirected to SetPassword page
9. ✅ User sets password successfully
10. ✅ Profile is updated with waitlist entry name
11. ✅ User is redirected to dashboard
12. ✅ User can access dashboard features

### Test Case 2: Existing User - Magic Link Click
1. ✅ User already exists in system
2. ✅ Admin grants access to waitlist entry
3. ✅ Magic link is generated
4. ✅ User clicks magic link
5. ✅ User signs in (no new account created)
6. ✅ Waitlist entry is linked (if not already)
7. ✅ User is redirected to SetPassword (if passwordless) or dashboard

### Test Case 3: Waitlist Entry Linking
1. ✅ Verify trigger links entry by email match
2. ✅ Verify manual fallback in SetPassword works
3. ✅ Verify linking works even if trigger timing is off

## Error Handling

### Scenario: Magic Link Expired
- Error message shown to user
- User can request new magic link from admin

### Scenario: User Already Has Password
- Still redirected to SetPassword
- Can update password if desired
- Proceeds to dashboard after submission

### Scenario: Waitlist Entry Linking Fails
- Non-critical error (logged)
- User can still proceed to dashboard
- Admin can manually link later if needed

### Scenario: Profile Update Fails
- Non-critical error (logged)
- User can still proceed
- Can update profile manually later

## Key Features

1. **Automatic User Creation**: Magic link automatically creates user if they don't exist
2. **Automatic Organization Creation**: User gets their own org with owner role
3. **Automatic Waitlist Linking**: Trigger links waitlist entry by email match
4. **Profile Population**: Waitlist entry data (name) is used to populate profile
5. **Password Setup**: Required for security (future logins)
6. **Welcome Experience**: Nice UI welcoming user to Early Access
7. **Fallback Mechanisms**: Manual linking if triggers don't fire

## Files Modified

1. `src/pages/auth/SetPassword.tsx` - NEW: Password setup page for waitlist users
2. `src/pages/auth/AuthCallback.tsx` - UPDATED: Handle waitlist_entry parameter
3. `src/App.tsx` - UPDATED: Added SetPassword route
4. Database triggers (already exist): Auto-create profile, org, and link waitlist

## Notes

- The trigger `link_user_to_waitlist` matches by email and prioritizes 'released' status entries
- If multiple waitlist entries exist for same email, it picks the earliest 'released' entry
- SetPassword has manual fallback to link waitlist entry if trigger didn't fire
- Profile is updated with waitlist entry name during password setup
- User has full dashboard access after password setup (org membership exists)
