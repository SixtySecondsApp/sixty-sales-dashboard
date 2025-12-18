# Password Reset Configuration Guide

## Overview
This guide helps you configure and troubleshoot the password reset functionality in your Supabase project.

## Recent Changes

### Enhanced Logging
Added comprehensive logging to help diagnose password reset issues:
- `src/pages/auth/forgot-password.tsx` - Enhanced client-side logging
- `src/lib/contexts/AuthContext.tsx` - Enhanced resetPassword function logging

When you attempt a password reset, check the browser console for detailed logs including:
- Email being used
- Redirect URL being sent to Supabase
- Success/error responses from Supabase

## Required Supabase Dashboard Configuration

### 1. Auth Settings - Redirect URLs

**Location:** Supabase Dashboard → Authentication → URL Configuration

You MUST whitelist the password reset redirect URL:

**For Local Development:**
```
http://localhost:5175/auth/reset-password
```

**For Production:**
```
https://sales.sixtyseconds.video/auth/reset-password
```

**How to add:**
1. Go to Supabase Dashboard
2. Navigate to Authentication → URL Configuration
3. Find "Redirect URLs" section
4. Add both URLs to the allowed list
5. Click "Save"

### 2. Email Templates

**Location:** Supabase Dashboard → Authentication → Email Templates

The local email template is at `supabase/email-templates/reset-password.html`.

**To deploy the custom template:**
1. Go to Supabase Dashboard
2. Navigate to Authentication → Email Templates
3. Select "Reset Password" template
4. Copy the contents from `supabase/email-templates/reset-password.html`
5. Paste into the template editor
6. Make sure the template uses `{{ .ConfirmationURL }}` variable
7. Click "Save"

**Important:** The template MUST use `{{ .ConfirmationURL }}` for the reset link.

### 3. Site URL

**Location:** Supabase Dashboard → Authentication → URL Configuration

Set the correct Site URL:

**For Production:**
```
https://sales.sixtyseconds.video
```

**For Local Development:**
```
http://localhost:5175
```

This is used as the base URL for all auth redirects.

### 4. Email Provider

**Location:** Supabase Dashboard → Project Settings → Auth

Ensure email sending is properly configured:

**Option A: Use Supabase SMTP (Default)**
- Should work out of the box for development
- May have rate limits
- Check Supabase status if emails aren't sending

**Option B: Custom SMTP (Recommended for Production)**
1. Go to Project Settings → Auth
2. Configure custom SMTP settings:
   - SMTP Host
   - SMTP Port
   - SMTP User
   - SMTP Password
   - Sender Email
   - Sender Name

## Testing Password Reset Flow

### Step 1: Request Password Reset

1. Navigate to `/auth/forgot-password`
2. Enter your email address
3. Click "Send Reset Code" (or "Send Reset Link" for Supabase)
4. **Open browser console** to check logs:
   ```
   [ForgotPassword] Attempting password reset for: your@email.com
   [ForgotPassword] Current window location: http://localhost:5175/auth/forgot-password
   === PASSWORD RESET DEBUG ===
   Email: your@email.com
   Redirect URL: http://localhost:5175/auth/reset-password
   ✅ Password reset email sent successfully
   ```

### Step 2: Check Email

1. Check your email inbox (and spam folder)
2. Look for email from Supabase or your configured sender
3. Click the "Reset Password" button or link
4. You should be redirected to `/auth/reset-password` with a token

### Step 3: Reset Password

1. On the reset password page, you should see the password reset form
2. If you see debug information instead, check the console logs
3. Enter your new password (at least 6 characters)
4. Click "Update Password"
5. You should be redirected to the dashboard and logged in

## Troubleshooting

### Problem: No Email Received

**Check Console Logs:**
```javascript
// Look for these logs in browser console:
=== PASSWORD RESET DEBUG ===
Email: your@email.com
Redirect URL: http://localhost:5175/auth/reset-password
✅ Password reset email sent successfully
```

**If you see an error instead:**
1. Check the error message in console
2. Common issues:
   - Email address doesn't exist in database (Supabase still returns success for security)
   - SMTP not configured properly
   - Rate limiting (too many requests)
   - Supabase service outage

**Solutions:**
1. Verify the email exists in Authentication → Users
2. Check Supabase status page
3. Check email spam folder
4. Wait a few minutes and try again (rate limiting)
5. Configure custom SMTP in Supabase dashboard

### Problem: Reset Link Doesn't Work

**Symptoms:**
- Clicking link shows "Invalid password reset link"
- Debug page shows missing token_hash or access_token

**Solutions:**
1. **Verify Redirect URL is whitelisted**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Ensure `http://localhost:5175/auth/reset-password` (or production URL) is in the list

2. **Check link hasn't expired**
   - Password reset links expire in 1 hour
   - Request a new reset link if expired

3. **Verify link format**
   - Link should contain `?token_hash=...&type=recovery`
   - Or legacy format: `#access_token=...&type=recovery`

### Problem: Can't Update Password

**Check Console Logs:**
```javascript
// Look for these in /auth/reset-password page:
✅ Recovery session established, updating password...
```

**If you see errors:**
1. Token may be expired - request new reset link
2. Session not established - check token verification logs
3. Password validation failed - ensure 6+ characters

**Solutions:**
1. Request a new password reset link
2. Ensure password meets minimum requirements (6+ characters)
3. Check browser console for specific error messages

## Production Deployment Checklist

Before deploying to production:

- [ ] Whitelist production redirect URL: `https://sales.sixtyseconds.video/auth/reset-password`
- [ ] Set correct Site URL: `https://sales.sixtyseconds.video`
- [ ] Deploy custom email template (optional but recommended)
- [ ] Configure custom SMTP (recommended for reliability)
- [ ] Test password reset flow in production
- [ ] Monitor Supabase logs for any errors

## Environment Variables

No additional environment variables needed. The password reset uses:
- `VITE_SUPABASE_URL` - Already configured
- `VITE_SUPABASE_ANON_KEY` - Already configured

## Support

If issues persist:
1. Check browser console logs (now enhanced with detailed logging)
2. Check Supabase Dashboard → Logs → Auth Logs
3. Verify all configuration steps above
4. Check Supabase status page: https://status.supabase.com

## Related Files

- `/src/pages/auth/forgot-password.tsx` - Forgot password page
- `/src/pages/auth/reset-password.tsx` - Reset password callback page
- `/src/lib/contexts/AuthContext.tsx` - resetPassword function
- `/src/lib/utils/siteUrl.ts` - URL helper functions
- `/supabase/email-templates/reset-password.html` - Custom email template
