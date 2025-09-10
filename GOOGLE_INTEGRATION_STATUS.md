# Google Integration Status

## Current Setup

### Edge Functions (Deployed and Active)
1. **google-oauth-initiate** - Initiates OAuth flow with PKCE
2. **google-oauth-callback** - Handles OAuth callback from Google
3. **google-gmail** - Gmail service proxy (for future use)
4. **google-calendar** - Calendar service proxy (for future use)  
5. **google-drive** - Drive service proxy (for future use)

### Database Functions (Need to be created via SQL)
Run the following SQL in Supabase SQL editor to bypass the 406 error:

```sql
-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS get_user_google_integration(UUID);

-- Create an RPC function to get user's Google integration
-- This bypasses the 406 header issue with direct REST API calls
CREATE OR REPLACE FUNCTION get_user_google_integration(p_user_id UUID)
RETURNS SETOF google_integrations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM google_integrations
    WHERE user_id = p_user_id
    AND is_active = true
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_google_integration(UUID) TO authenticated;

-- Also create a simpler version that uses auth.uid()
DROP FUNCTION IF EXISTS get_my_google_integration();

CREATE OR REPLACE FUNCTION get_my_google_integration()
RETURNS TABLE(
    id UUID,
    user_id UUID,
    email TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.id,
        gi.user_id,
        gi.email,
        gi.expires_at,
        gi.scopes,
        gi.is_active,
        gi.created_at,
        gi.updated_at
    FROM google_integrations gi
    WHERE gi.user_id = auth.uid()
    AND gi.is_active = true
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_my_google_integration() TO authenticated;
```

## OAuth Flow

1. User clicks "Connect Google" button in `/integrations`
2. Frontend calls `google-oauth-initiate` Edge Function
3. Edge Function returns OAuth URL with PKCE parameters
4. User is redirected to Google for authorization
5. Google redirects back to `/auth/google/callback`
6. React component redirects to `google-oauth-callback` Edge Function
7. Edge Function exchanges code for tokens and stores in database
8. User is redirected back to `/integrations` with success status

## Known Issues

### 406 Error on REST API
- **Issue**: Direct queries to `google_integrations` table return 406 "Not Acceptable"
- **Cause**: PostgREST header negotiation issue
- **Solution**: Use RPC functions (`get_my_google_integration` or `get_user_google_integration`)

### Environment Variables Required
Set these in Supabase Dashboard > Edge Functions > Secrets:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (should be `http://localhost:5173/auth/google/callback` for local dev)
- `FRONTEND_URL` (should be `http://localhost:5173` for local dev)

## File Structure

### Frontend Components
- `/src/pages/Integrations.tsx` - Main integrations page
- `/src/pages/GoogleCallback.tsx` - OAuth callback handler
- `/src/lib/api/googleIntegration.ts` - API client for Google integration
- `/src/lib/stores/integrationStore.ts` - Zustand store for integration state

### Edge Functions
- `/supabase/functions/google-oauth-initiate/` - OAuth initiation
- `/supabase/functions/google-oauth-callback/` - OAuth callback handler
- `/supabase/functions/google-gmail/` - Gmail service (future)
- `/supabase/functions/google-calendar/` - Calendar service (future)
- `/supabase/functions/google-drive/` - Drive service (future)

### Database
- `google_integrations` table - Stores OAuth tokens and integration status
- `google_oauth_states` table - Temporary storage for OAuth state and PKCE verifier
- `google_service_logs` table - Logs for debugging

## Testing

1. Run the SQL functions above in Supabase SQL editor
2. Ensure Edge Functions are deployed and secrets are set
3. Start the dev server: `npm run dev`
4. Navigate to `/integrations`
5. Click "Connect Google Account"
6. Complete OAuth flow
7. Verify integration status shows as connected

## Cleanup Notes

The following Edge Functions can be removed if not needed:
- `google-oauth` - Replaced by `google-oauth-initiate` and `google-oauth-callback`
- `google-workspace` - Not currently used

Keep the service-specific functions (gmail, calendar, drive) for future implementation.