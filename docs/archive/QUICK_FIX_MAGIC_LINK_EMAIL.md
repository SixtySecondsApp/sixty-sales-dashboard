# Quick Fix: Magic Link Email Template

## Immediate Steps to Fix

### 1. Update Supabase Magic Link Template (Dashboard Method)

**Go to Supabase Dashboard:**
- Project → Authentication → Email Templates
- Select **"Magic Link"** (NOT "Confirm signup")

**Update Subject:**
```
Welcome to Early Access! 🎉
```

**Update Body:**
Copy the entire contents from: `supabase/email-templates/magic-link-waitlist.html`

Paste into the Body field and Save.

### 2. Verify Site URL Configuration

**Go to Supabase Dashboard:**
- Settings → Authentication
- **Site URL** should be: `https://app.use60.com`
- **Redirect URLs** should include: `https://app.use60.com/auth/callback*`

### 3. Why the Redirect URL Was Wrong

The email you received showed:
```
redirect_to=https://app.use60.com
```

But it should be:
```
redirect_to=https://app.use60.com/auth/callback?waitlist_entry={entryId}
```

**The code is correct** - it sets:
```typescript
emailRedirectTo: `${window.location.origin}/auth/callback?waitlist_entry=${entryId}`
```

**Possible causes:**
1. Supabase Site URL override (if Site URL doesn't match, it may use Site URL instead)
2. Template using wrong variable (should use `{{ .ConfirmationURL }}`)
3. Supabase caching old template

**After updating the template, test again by:**
1. Resending a magic link
2. Checking the email link includes `/auth/callback?waitlist_entry=`

## Template File Location

The template HTML is at:
- `supabase/email-templates/magic-link-waitlist.html`

Key features:
- ✅ "Welcome to Early Access! 🎉" heading
- ✅ "Get Started" button (instead of "Sign In")
- ✅ Features list (AI Meeting Notes, Smart CRM Sync, Action Items)
- ✅ Uses `{{ .ConfirmationURL }}` which includes the redirect URL
