# Authentication System Fix Documentation

## Problem Summary
The authentication system was failing to load user profile data (name, stage, admin privileges) even though users could successfully log in. This issue occurred twice in two days and required a permanent solution.

## Root Causes Identified

### 1. ID Mismatch Problem
- **Issue**: The auth user ID (`auth.users.id`) didn't always match the profile ID (`profiles.id`)
- **Cause**: Profiles were created manually or before authentication setup
- **Impact**: Profile lookups by ID would fail silently

### 2. Unreliable Primary Key
- **Issue**: Using `user.id` as the primary lookup key was unreliable
- **Cause**: IDs can diverge when:
  - Profiles are created manually
  - Users are imported from another system
  - Database is restored from backup
  - Auth and profiles tables get out of sync
- **Impact**: Intermittent profile loading failures

### 3. Race Conditions
- **Issue**: Profile fetch happening before session fully established
- **Cause**: Async initialization without proper sequencing
- **Impact**: Profile would be null on first load

### 4. No Caching
- **Issue**: Profile fetched repeatedly on every render
- **Cause**: No caching mechanism in place
- **Impact**: Performance issues and potential rate limiting

## Permanent Solution Implemented

### 1. Email-Based Primary Lookup
```typescript
// ALWAYS use email as primary identifier
const { data: profile } = await client
  .from('profiles')
  .select('*')
  .eq('email', userEmail)  // Email is the reliable constant
  .maybeSingle();
```

### 2. Profile Caching System
```typescript
// 5-minute cache to prevent repeated fetches
const profileCache = useRef<{ 
  profile: UserProfile | null; 
  timestamp: number; 
  email: string | null 
}>({ 
  profile: null, 
  timestamp: 0,
  email: null 
});
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

### 3. Robust Fallback Chain
1. Check cache first (if not expired)
2. Fetch by email (primary method)
3. Fallback to ID lookup if email fails
4. Log detailed errors for debugging

### 4. Enhanced Error Handling
- Removed automatic profile creation with defaults
- Clear error messages in console
- No silent failures

## Files Modified

### `/src/lib/contexts/AuthContext.tsx`
- Changed `fetchUserProfile` to use email-based lookup
- Added profile caching mechanism
- Improved `refreshProfile` function
- Enhanced logging throughout

### `/src/components/ProfileRefreshButton.tsx`
- Added manual refresh capability
- Enhanced debug logging
- Shows current profile state

### `/scripts/fix-profile-permanently.js`
- Script to verify and fix all user profiles
- Ensures email consistency between auth and profiles
- Sets correct admin privileges

## How to Prevent Future Issues

### 1. Database Best Practices
- **ALWAYS** use email as the linking field between auth and profiles
- **NEVER** rely on ID matching between tables
- **CREATE** profiles via database trigger on user signup (recommended)

### 2. Code Guidelines
```typescript
// ❌ DON'T DO THIS
const profile = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)  // Unreliable!
  .single();

// ✅ DO THIS INSTEAD
const profile = await supabase
  .from('profiles')
  .select('*')
  .eq('email', user.email)  // Reliable!
  .maybeSingle();
```

### 3. Testing Checklist
- [ ] User can log in
- [ ] Profile loads with correct name
- [ ] User stage displays correctly
- [ ] Admin privileges work (if applicable)
- [ ] Profile refresh button works
- [ ] Data persists across page refreshes
- [ ] Works in incognito mode

### 4. Monitoring
Check browser console for these success indicators:
```
🚀 Initializing auth...
🔐 Session found for user: andrew.bryce@sixtyseconds.video
🔍 Fetching fresh profile for email: andrew.bryce@sixtyseconds.video
✅ Profile fetched successfully: {
  name: "Andrew Bryce",
  stage: "Director",
  isAdmin: true
}
```

## Quick Fixes

### If Profile Not Loading:
1. Click the profile refresh button (bottom left circular icon)
2. Check browser console for errors
3. Run the fix script: `node scripts/fix-profile-permanently.js`
4. Clear browser cache and localStorage
5. Try incognito mode

### If Admin Privileges Missing:
1. Verify in database: profile.is_admin should be true
2. Check browser console for profile data
3. Click refresh button to force reload
4. Run fix script if needed

## Database Schema Requirements

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,  -- Critical: Must match auth.users.email
  first_name TEXT,
  last_name TEXT,
  stage TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups (critical for performance)
CREATE INDEX idx_profiles_email ON profiles(email);
```

### Recommended: Auto-Create Profile Trigger
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## Testing the Fix

### Manual Test
1. Log out completely
2. Clear browser storage: `localStorage.clear()`
3. Log in with credentials
4. Verify profile loads immediately
5. Check admin menu visibility (if admin)
6. Test profile refresh button

### Automated Test
```bash
# Run the profile verification script
node scripts/fix-profile-permanently.js

# Check specific user
node -e "
const { createClient } = require('@supabase/supabase-js');
// ... check profile by email
"
```

## Key Learnings

1. **Email is King**: Always use email as the primary identifier between auth and profile systems
2. **Cache Aggressively**: Reduce database calls with intelligent caching
3. **Log Everything**: Detailed logging helps diagnose intermittent issues
4. **Test ID Mismatches**: Always test with profiles that have mismatched IDs
5. **Avoid Defaults**: Don't create profiles with default values - wait for real data

## Support

If authentication issues persist:
1. Check this documentation first
2. Run `node scripts/fix-profile-permanently.js`
3. Check browser console for detailed error logs
4. Verify database has correct profile data
5. Test in incognito mode to rule out cache issues

## Version History
- **2025-01-10**: Implemented permanent fix using email-based lookup
- **Previous**: Used ID-based lookup (unreliable, deprecated)