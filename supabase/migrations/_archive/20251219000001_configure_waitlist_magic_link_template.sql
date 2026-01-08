-- ============================================================================
-- Configure Waitlist Magic Link Email Template for Supabase Auth
-- ============================================================================
-- IMPORTANT: This SQL provides instructions for configuring the Magic Link
-- template in Supabase Dashboard. Supabase stores email templates in system
-- tables that are not directly modifiable via SQL in Supabase Cloud.
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard → Authentication → Email Templates
-- 2. Select "Magic Link" template
-- 3. Copy the HTML from: supabase/email-templates/magic-link-waitlist.html
-- 4. Paste into the Body field
-- 5. Set Subject to: "Welcome to Early Access! 🎉"
-- 6. Save the template
--
-- ============================================================================
-- IMPORTANT NOTES:
-- ============================================================================
-- 1. The {{ .ConfirmationURL }} variable will automatically include the
--    emailRedirectTo parameter passed in signInWithOtp options
-- 2. Make sure your Site URL in Supabase Settings → Authentication is set to:
--    https://app.use60.com (or your production domain)
-- 3. The emailRedirectTo in waitlistAdminService.ts already includes the
--    waitlist_entry parameter: /auth/callback?waitlist_entry={entryId}
-- 4. If redirect URLs aren't working, check:
--    - Site URL in Supabase Settings matches your domain
--    - emailRedirectTo is being set correctly in the code
--    - Redirect URLs are allowed in Supabase Settings → Authentication
--
-- ============================================================================
-- ALTERNATIVE: If you have direct database access to auth schema
-- ============================================================================
-- Supabase Cloud doesn't allow direct SQL access to auth.config, but if you
-- have self-hosted Supabase or special access, the templates are stored in:
-- 
-- SELECT * FROM auth.config WHERE key = 'SMTP_TEMPLATE_MAGIC_LINK';
--
-- However, this is NOT recommended and may break with Supabase updates.
-- Use the Dashboard method instead.
--
-- ============================================================================

-- This migration file serves as documentation only
-- No SQL changes are needed - configuration is done via Dashboard

SELECT 'Please configure the Magic Link email template via Supabase Dashboard:
  1. Go to: Dashboard → Authentication → Email Templates
  2. Select "Magic Link" template  
  3. Copy HTML from: supabase/email-templates/magic-link-waitlist.html
  4. Set Subject: "Welcome to Early Access! 🎉"
  5. Save template
  
The {{ .ConfirmationURL }} variable will automatically use the emailRedirectTo
parameter from signInWithOtp, which includes waitlist_entry={entryId}'
AS instructions;
