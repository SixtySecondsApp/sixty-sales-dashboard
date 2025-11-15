# Test User Setup Guide

This guide explains how to set up test user credentials for local development and testing.

## Quick Setup

### Option 1: Using the Script (Recommended)

1. **Create a `.env` file** in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   TEST_USER_EMAIL=test@sixty.com
   TEST_USER_PASSWORD=TestPassword123!
   ```

2. **Run the create test user script**:
   ```bash
   node scripts/create-test-user.js
   ```

   This will:
   - Create the test user if it doesn't exist
   - Verify credentials if the user already exists
   - Provide login instructions

### Option 2: Via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Users**
3. Click **"Add User"** or **"Invite User"**
4. Enter:
   - **Email**: `test@sixty.com`
   - **Password**: `TestPassword123!`
   - **Auto Confirm**: ON (to skip email verification)
5. Click **"Create User"**

### Option 3: Via Signup Page

1. Navigate to `/auth/signup` in your app
2. Enter:
   - **Email**: `test@sixty.com`
   - **Password**: `TestPassword123!`
3. Complete the signup process
4. **Note**: If email confirmation is enabled, you'll need to confirm the email

## Test Credentials

Use these credentials to log in:

- **Email**: `andrew.bryce@sixtyseconds.video`
- **Password**: `J7571qJ7571q`

## Disabling Email Confirmation (Optional)

For easier testing, you can disable email confirmation:

1. Go to Supabase Dashboard
2. Navigate to **Authentication > Settings**
3. Under **Email Auth**, toggle **"Confirm email"** to OFF
4. Save changes

This allows you to log in immediately after creating a user without email verification.

## Verifying Test User

To verify your test user is set up correctly:

1. Navigate to `/auth/login`
2. Enter the test credentials
3. You should be redirected to the dashboard

## Troubleshooting

### User Already Exists Error

If you get an "already registered" error:
- The user exists but may have a different password
- Reset the password in Supabase Dashboard, or
- Delete the user and create it again

### Email Confirmation Required

If you're prompted for email confirmation:
- Check your email inbox for the confirmation link, or
- Disable email confirmation in Supabase Dashboard (see above)

### Profile Not Loading

If the user logs in but profile data doesn't load:
- The profile may not have been created automatically
- Check the `profiles` table in Supabase
- You may need to manually create a profile entry

## Browser Testing

Once the test user is set up, you can use it for browser testing:

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Log in with the test credentials
4. Test the Email and Calendar icons in the top bar

