# Deployment Guide: Impersonation Fixes

## Overview
This deployment fixes two critical impersonation issues:
1. Password reset requirement after stopping impersonation
2. Missing deals when impersonating users

## Changes Made

### 1. Database Migration
- **File**: `supabase/migrations/20250820_fix_admin_deals_visibility.sql`
- **Purpose**: Updates RLS policies to allow admins to see all deals when impersonating
- **Key Changes**:
  - Added `auth.is_admin()` function to check admin status
  - Updated all deal-related RLS policies to grant admin access
  - Updated activities and clients table policies

### 2. Edge Functions
- **Files**: 
  - `supabase/functions/impersonate-user/index.ts`
  - `supabase/functions/restore-user/index.ts`
- **Purpose**: Use session-based impersonation instead of magic links to preserve passwords
- **Key Changes**:
  - Use `createSession()` instead of `generateLink()` for session preservation
  - Fallback to magic links only if session creation fails

### 3. Frontend Updates
- **Files**:
  - `src/lib/hooks/useUser.ts`
  - `src/lib/hooks/useUsers.ts`
- **Purpose**: Handle session-based impersonation and restoration
- **Key Changes**:
  - Use `setSession()` to apply sessions directly
  - Handle both session and magic link responses

## Deployment Steps

### Step 1: Deploy Database Migration
```bash
# Connect to your Supabase project
npx supabase link --project-ref <your-project-ref>

# Apply the migration
npx supabase migration up
```

### Step 2: Deploy Edge Functions
```bash
# Deploy the updated edge functions
npx supabase functions deploy impersonate-user
npx supabase functions deploy restore-user
```

### Step 3: Deploy Frontend
```bash
# Build and deploy the frontend (Vercel)
npm run build
vercel --prod
```

## Testing Checklist

After deployment, test the following:

### Impersonation Flow
1. [ ] Login as admin user
2. [ ] Navigate to Users page (/admin/users)
3. [ ] Click "Impersonate" on any user
4. [ ] Verify you're logged in as that user
5. [ ] Verify you can see ALL deals (not just the user's deals)
6. [ ] Click "Stop Impersonation" 
7. [ ] Verify you're back as admin WITHOUT needing password reset
8. [ ] Verify your session is fully restored

### Data Visibility
1. [ ] As admin, verify you see all deals across all users
2. [ ] As regular user, verify you only see your own deals
3. [ ] When impersonating, verify admin privileges are maintained

### Edge Cases
1. [ ] Test impersonating a user with no deals
2. [ ] Test rapid switching between impersonations
3. [ ] Test browser refresh during impersonation
4. [ ] Test logging out during impersonation

## Rollback Plan

If issues occur, rollback using:

### Database Rollback
```sql
-- Revert to original RLS policies
DROP FUNCTION IF EXISTS auth.is_admin();
-- Re-apply original policies from previous migration
```

### Edge Functions Rollback
```bash
# Revert to previous version
npx supabase functions deploy impersonate-user --version <previous-version>
npx supabase functions deploy restore-user --version <previous-version>
```

### Frontend Rollback
```bash
# Revert in Vercel dashboard or via CLI
vercel rollback
```

## Monitoring

After deployment, monitor:
1. Supabase Dashboard → Edge Functions → Check for errors
2. Supabase Dashboard → Database → Check query performance
3. Application logs for any session-related errors
4. User reports of authentication issues

## Support

If issues persist:
1. Check edge function logs in Supabase Dashboard
2. Verify RLS policies are applied correctly
3. Check browser console for session errors
4. Contact support with specific error messages