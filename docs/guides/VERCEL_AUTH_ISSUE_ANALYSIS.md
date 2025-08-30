# Vercel Deployment Authentication Issue Analysis

## Problem Summary
After deploying to Vercel, users lose access with their current password and need to reset their password to the same password to regain access. This suggests an issue with session management or authentication state during deployments.

## Root Cause Analysis

### 1. **Environment Variable Configuration**
The application uses Vite environment variables for Supabase configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`

**Issue**: Vite environment variables need to be properly configured in Vercel's environment settings.

### 2. **Session Invalidation During Deployment**
- Supabase sessions are stored in browser localStorage by default
- During deployments, if environment variables change or there are cache invalidations, existing sessions may become invalid
- The Supabase client configuration might be inconsistent between local and deployed environments

### 3. **User Impersonation System Side Effects**
The codebase includes a complex user impersonation system that:
- Generates temporary passwords via Supabase Edge Functions
- Uses `signInWithPassword` with temporary credentials
- Modifies user authentication state

This system could be interfering with normal authentication flows.

### 4. **Supabase Client Configuration**
The client is configured without explicit session persistence settings:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Solutions

### Immediate Fixes

#### 1. **Verify Vercel Environment Variables**
Ensure all Supabase environment variables are properly set in Vercel:

```bash
# In Vercel Dashboard or CLI
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Action Required**: Check Vercel project settings → Environment Variables

#### 2. **Add Explicit Session Configuration**
Update the Supabase client configuration to be more explicit about session handling:

**File**: `src/lib/supabase/client.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing env.VITE_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env.VITE_SUPABASE_ANON_KEY');
if (!supabaseServiceKey) throw new Error('Missing env.VITE_SUPABASE_SERVICE_ROLE_KEY');

// Regular client for normal operations with explicit session config
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Admin client with service role for admin operations, configured to avoid auth conflicts
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Don't persist admin sessions
    autoRefreshToken: false // Disable auto refresh for admin client
  }
});
```

#### 3. **Add Session Recovery Logic**
Enhance the AuthGuard component to handle session recovery:

**File**: `src/components/AuthGuard.tsx` (add to the checkAuth function)
```typescript
const checkAuth = async () => {
  try {
    // First try to get existing session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // If no session but we have tokens in localStorage, try to recover
    if (!session && !sessionError) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError && userError.message.includes('session')) {
        // Session is invalid, clear it and redirect to login
        await supabase.auth.signOut();
      }
    }
    
    const isPublicRoute = publicRoutes.includes(location.pathname);

    if (!session && !isPublicRoute) {
      navigate('/auth/login');
    } else if (session && isPublicRoute) {
      if (location.pathname !== '/auth/reset-password') {
        navigate('/');
      }
    }
  } catch (error) {
    console.error('Auth check error:', error);
    // If there's an error, sign out and redirect to login
    await supabase.auth.signOut();
    navigate('/auth/login');
  } finally {
    setIsLoading(false);
  }
};
```

#### 4. **Environment Variable Validation**
Add runtime validation to ensure environment variables are correctly loaded:

**File**: `src/lib/supabase/client.ts` (add after the createClient calls)
```typescript
// Debug logging for environment variables (remove in production)
if (import.meta.env.DEV) {
  console.log('Supabase Config:', {
    url: supabaseUrl?.substring(0, 20) + '...',
    anonKey: supabaseAnonKey?.substring(0, 10) + '...',
    hasServiceKey: !!supabaseServiceKey
  });
}
```

### Long-term Improvements

#### 1. **Implement Session Refresh Strategy**
Add automatic session refresh handling:

```typescript
// In AuthGuard or main App component
useEffect(() => {
  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh failed:', error);
      await supabase.auth.signOut();
    }
  };

  // Refresh session every 30 minutes
  const interval = setInterval(refreshSession, 30 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

#### 2. **Add Deployment Hook**
Consider adding a Vercel deployment hook to clear user sessions:

**File**: `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/:path((?!api|.*\\.\\w+).*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_DEPLOYMENT_ID": "@vercel-deployment-id"
  }
}
```

#### 3. **Review Impersonation System**
The impersonation system might be causing authentication conflicts. Consider:
- Using JWT tokens instead of password-based impersonation
- Implementing role-based access without session switching
- Adding more robust cleanup when impersonation ends

## Testing Steps

1. **Verify Environment Variables**:
   ```bash
   # In browser console after deployment
   console.log(import.meta.env.VITE_SUPABASE_URL);
   ```

2. **Check Session State**:
   ```javascript
   // In browser console
   const session = await supabase.auth.getSession();
   console.log('Current session:', session);
   ```

3. **Monitor Network Requests**:
   - Check if Supabase API calls are using correct URLs
   - Verify authentication headers are present

## Immediate Action Items

1. ✅ **Check Vercel environment variables** - Ensure all VITE_SUPABASE_* variables are set
2. ✅ **Update Supabase client configuration** - Add explicit session handling
3. ✅ **Add session recovery logic** - Handle invalid sessions gracefully
4. ✅ **Test deployment** - Verify the fix works
5. ✅ **Monitor user reports** - Confirm the issue is resolved

## Additional Notes

- The issue might be related to the `flowType: 'pkce'` setting in newer Supabase versions
- Consider implementing a "force refresh" mechanism for users experiencing issues
- Monitor Supabase dashboard for any authentication-related errors during deployments