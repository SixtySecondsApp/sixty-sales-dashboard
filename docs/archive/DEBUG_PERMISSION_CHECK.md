# Permission Debug Guide

Follow these steps to debug why the `/platform/meetings-waitlist` page isn't loading:

## Step 1: Check Browser Console

Open the browser console (F12 or Cmd+Option+I) and paste this:

```javascript
// Check if user is logged in
const { data: { session } } = await (window as any).supabase.auth.getSession();
console.log('Session:', session);

// Check profiles table
const { data: profile } = await (window as any).supabase
  .from('profiles')
  .select('*')
  .eq('email', session?.user?.email)
  .single();
console.log('Profile:', profile);
console.log('is_admin flag:', profile?.is_admin);

// Check internal domains
const { data: domains } = await (window as any).supabase
  .from('internal_domains')
  .select('*');
console.log('Internal domains:', domains);

// Check user type
const email = session?.user?.email;
const domain = email?.split('@')[1];
console.log('Email domain:', domain);
console.log('Is internal?', domain === 'sixtyseconds.video');
