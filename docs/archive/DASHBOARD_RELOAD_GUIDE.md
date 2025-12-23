# How to Reload PostgREST Schema Cache in Supabase Dashboard

## Step-by-Step Navigation

### Step 1: Access Your Project
Go to: **https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr**

### Step 2: Open Settings
1. Look at the **left sidebar**
2. Scroll down to the **"Settings"** section (gear icon ⚙️)
3. Click on **"Settings"**

### Step 3: Navigate to API Settings
In the Settings menu, you'll see several options:
- General
- Database
- **API** ← Click this one
- Auth
- Storage
- etc.

### Step 4: Reload Schema
On the API Settings page, look for:
- **API Settings** section at the top
- **"Configuration"** or **"Schema"** section
- A button labeled one of:
  - **"Reload schema"**
  - **"Refresh schema cache"**
  - **"Restart PostgREST"**

## Alternative: Try the Database Page

If you don't see it in Settings → API, try:

1. Go to **Database** in the left sidebar
2. Click on **"Database"**
3. Look for a **refresh/reload icon** or button near the table list
4. Or try the **"Extensions"** tab and toggle PostgREST off/on

## Alternative: Use SQL Editor

If the button isn't visible, you can force a schema reload by making a DDL change:

1. Go to **SQL Editor** in the left sidebar
2. Create a new query
3. Run this harmless SQL:
   ```sql
   -- Force schema reload
   COMMENT ON TABLE profiles IS 'User profiles - updated';

   -- Verify it worked
   SELECT 'Schema updated' as status;
   ```
4. Click **"Run"**
5. Wait 30 seconds
6. Try running: `node sync-data-via-api.mjs`

## If Still Not Found

The schema cache issue might auto-resolve. You can:

1. **Wait 15-30 minutes** - PostgREST will eventually detect the changes
2. **Try the sync script anyway** - run `node sync-data-via-api.mjs` and see if it works now
3. **Contact Supabase Support** - They can manually restart PostgREST for your branch

## Test If Cache Has Refreshed

Run this quick test:
```bash
node trigger-cache-reload.mjs
```

This will tell you if the tables are now accessible.

## Current Project Details

- **Project Ref**: jczngsvpywgrlgdwzjbr
- **Branch**: development-v2 (preview branch)
- **URL**: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr

## What We're Trying to Fix

The PostgREST API layer needs to refresh its internal cache of your database schema. This cache tells PostgREST which tables exist and how to query them. Since we just applied 270+ migrations via GitHub Actions, PostgREST hasn't detected the new tables yet.
