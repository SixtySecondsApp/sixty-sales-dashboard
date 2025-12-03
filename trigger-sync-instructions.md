# Trigger Manual Data Sync

## Steps:
1. Go to: https://github.com/[your-username]/sixty-sales-dashboard/actions
2. Find workflow: "Sync Production Data to Development"
3. Click "Run workflow" button (top right)
4. Select branch: `main`
5. Click green "Run workflow" button
6. Wait 5-10 minutes for completion

## What it will do:
- Export all data from production database
- Import into development-v2 branch
- Copy auth.users (your login credentials)
- Copy all CRM data (deals, contacts, activities, etc.)
- Preserve data relationships

## After completion:
- Restart your dev server: `npm run dev`
- You'll be able to log in with your production credentials
- All your production data will be available for testing
