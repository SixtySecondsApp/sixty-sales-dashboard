# Waitlist Magic Link Email Template Setup

## Problem
When resending magic links for waitlist users, the email shows:
- ❌ Generic "Confirm your email" template
- ❌ Wrong redirect URL (doesn't include `waitlist_entry` parameter)

## Solution

### Step 1: Update Supabase Magic Link Email Template

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Email Templates**
   - Select **"Magic Link"** template

2. **Update Subject Line**
   ```
   Welcome to Early Access! 🎉
   ```

3. **Copy HTML Template**
   - Open: `supabase/email-templates/magic-link-waitlist.html`
   - Copy the entire HTML content
   - Paste into the **Body** field in Supabase Dashboard

4. **Save Template**
   - Click **Save** to apply changes

### Step 2: Verify Redirect URL Configuration

The code already sets the correct redirect URL in `waitlistAdminService.ts`:

```typescript
emailRedirectTo: `${window.location.origin}/auth/callback?waitlist_entry=${entryId}`
```

**However**, Supabase may override this if your **Site URL** doesn't match. Check:

1. **Go to Supabase Dashboard**
   - Navigate to: **Settings** → **Authentication**
   - Check **Site URL** is set to: `https://app.use60.com`

2. **Verify Redirect URLs**
   - In same page, check **Redirect URLs**
   - Ensure `https://app.use60.com/auth/callback*` is in the allowed list

### Step 3: Test the Flow

1. Grant access to a test waitlist entry
2. Click "Resend Magic Link" in admin panel
3. Check the email you receive:
   - ✅ Should show "Welcome to Early Access! 🎉"
   - ✅ Should have "Get Started" button
   - ✅ Should show the features list
   - ✅ Link should include `waitlist_entry={id}` parameter

### How It Works

1. **Magic Link Generation**
   - `resendMagicLink()` calls `signInWithOtp()` with `emailRedirectTo` parameter
   - Supabase generates magic link with the redirect URL embedded

2. **Email Template**
   - Uses the custom template you configured
   - `{{ .ConfirmationURL }}` variable includes the full redirect URL
   - URL format: `https://[supabase-url]/auth/v1/verify?token=...&redirect_to=https://app.use60.com/auth/callback?waitlist_entry={id}`

3. **User Clicks Link**
   - Supabase verifies token
   - Redirects to `/auth/callback?waitlist_entry={id}`
   - `AuthCallback` detects `waitlist_entry` parameter
   - Redirects to `/auth/set-password`
   - User sets password and gets dashboard access

### Troubleshooting

**Issue: Redirect URL doesn't include waitlist_entry**
- ✅ Check `emailRedirectTo` in code includes the parameter
- ✅ Check Site URL in Supabase matches your domain
- ✅ Check redirect URLs are allowed in Supabase Settings

**Issue: Email still shows "Confirm your email"**
- ✅ Verify you saved the Magic Link template (not Signup template)
- ✅ Clear browser cache and check again
- ✅ Try sending a new magic link after saving template

**Issue: Template variables not working**
- ✅ Ensure `{{ .ConfirmationURL }}` is exactly as shown (case sensitive)
- ✅ Don't modify the variable syntax

### Files Modified

1. **New File**: `supabase/email-templates/magic-link-waitlist.html`
   - Custom HTML template for waitlist early access emails

2. **New File**: `supabase/migrations/20251219000001_configure_waitlist_magic_link_template.sql`
   - Documentation SQL file with setup instructions

3. **Code Already Correct**: `src/lib/services/waitlistAdminService.ts`
   - Already sets `emailRedirectTo` with `waitlist_entry` parameter
