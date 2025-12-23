# Google OAuth Dynamic Environment Setup

This guide covers setting up Google OAuth with dynamic redirect URIs that work seamlessly across development (localhost:5173) and production (sales.sixtyseconds.video) environments.

## Overview

The Google OAuth integration has been updated to automatically detect the environment and use the appropriate redirect URI without requiring manual configuration changes. This solution:

- Automatically detects if running on localhost or production
- Uses the appropriate redirect URI without manual configuration changes  
- Works seamlessly when deployed to sales.sixtyseconds.video
- Maintains backward compatibility with existing setup

## Google Console Configuration

### 1. Add Authorized Redirect URIs

In your Google Cloud Console project, navigate to **APIs & Services > Credentials** and add both redirect URIs to your OAuth 2.0 client:

```
http://localhost:5173/auth/google/callback
https://sales.sixtyseconds.video/auth/google/callback
```

### 2. Authorized JavaScript Origins

Also add both origins to the authorized JavaScript origins:

```
http://localhost:5173
https://sales.sixtyseconds.video
```

## Environment Variables

### Development (.env.local)

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (these can remain the same for both environments)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Production Environment Variables

Set the same environment variables in your production environment (Netlify, Vercel, etc.):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Note**: You no longer need to set `GOOGLE_REDIRECT_URI` as it's now dynamically determined.

## How Dynamic Detection Works

### 1. Frontend Detection

When initiating OAuth, the frontend automatically detects the current origin:

```typescript
// In GoogleIntegrationAPI.initiateOAuth()
const origin = window.location.origin;
// Passes this to the Edge Function
```

### 2. Edge Function Processing

The `google-oauth-initiate` Edge Function receives the origin and constructs the redirect URI:

```typescript
// Dynamic redirect URI construction
let redirectUri: string;
if (requestOrigin) {
  redirectUri = `${requestOrigin}/auth/google/callback`;
} else {
  // Fallback to localhost for development
  redirectUri = 'http://localhost:5173/auth/google/callback';
}
```

### 3. CORS Configuration

Both Edge Functions now use dynamic CORS headers that allow requests from:
- `http://localhost:5173` (development)
- `http://localhost:3000` (alternative dev port)
- `https://sales.sixtyseconds.video` (production)

## Files Modified

### Updated Edge Functions

1. **`/supabase/functions/google-oauth-initiate/index.ts`**
   - Added dynamic redirect URI detection from request origin
   - Updated CORS headers to support multiple origins
   - Stores dynamic redirect URI in database state

2. **`/supabase/functions/google-oauth-exchange/index.ts`**  
   - Updated CORS headers to support multiple origins
   - Uses stored redirect URI from database for token exchange

### Updated Frontend

3. **`/src/lib/api/googleIntegration.ts`**
   - Modified `initiateOAuth()` to pass `window.location.origin` to Edge Function
   - Enables automatic environment detection

4. **`/src/pages/GoogleCallback.tsx`**
   - No changes needed - already works with dynamic URLs
   - Handles OAuth callback regardless of origin

## Testing

### Development Testing

1. Start development server: `npm run dev`
2. Navigate to integrations page
3. Click "Connect Google Account" 
4. Verify redirect URI shows `http://localhost:5173/auth/google/callback`
5. Complete OAuth flow

### Production Testing

1. Deploy to production environment
2. Navigate to integrations page on `https://sales.sixtyseconds.video`
3. Click "Connect Google Account"
4. Verify redirect URI shows `https://sales.sixtyseconds.video/auth/google/callback`
5. Complete OAuth flow

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify the allowed origins in the Edge Functions match your domains
   - Check that the frontend origin is being passed correctly

2. **Redirect URI Mismatch**
   - Ensure both redirect URIs are added to Google Console
   - Verify the dynamic construction is working in Edge Function logs

3. **Token Exchange Errors**
   - Check that the stored redirect URI matches what was used in the auth URL
   - Verify CORS headers are properly configured

### Debug Logging

The Edge Functions include comprehensive logging:

```
[Google OAuth Initiate] Using redirect URI: https://sales.sixtyseconds.video/auth/google/callback
[Google OAuth Exchange] Token exchange response status: 200
```

Check your Supabase Edge Function logs for these messages.

## Security Considerations

1. **Origin Validation**: Only requests from allowed origins are accepted
2. **State Parameter**: Prevents CSRF attacks with secure random state
3. **PKCE**: Uses PKCE flow for additional security
4. **Token Storage**: Tokens are securely stored in Supabase with RLS

## Migration from Static Configuration

If you previously had a static `GOOGLE_REDIRECT_URI` environment variable:

1. Remove the `GOOGLE_REDIRECT_URI` environment variable (optional - it's now ignored)
2. Ensure both redirect URIs are configured in Google Console
3. Deploy the updated Edge Functions
4. Test both development and production flows

The system will automatically work with the new dynamic detection while maintaining backward compatibility.