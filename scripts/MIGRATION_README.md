# Discovery Meeting Types Migration

## Overview
This migration merges "Discovery Call" and "Discovery Meeting" into a single "Discovery" type across the application.

## Changes Made

### 1. Code Updates
- **useActivityFilters.ts**: Updated `MeetingType` type definition to use "Discovery" instead of "Discovery Call" and "Discovery Meeting"
- **QuickAdd.tsx**: Updated dropdown options to show "Discovery" 
- **SalesTable.tsx**: Updated filter dropdown options to show "Discovery"

### 2. Database Migration
- Created migration script: `scripts/merge-discovery-types.js`
- Created SQL migration: `supabase/migrations/20250701000000_merge_discovery_types.sql`
- Both update existing records from "Discovery Call" and "Discovery Meeting" to "Discovery"

### 3. Rollback Support
- Created rollback script: `scripts/rollback-discovery-merge.js`
- Note: Rollback requires manual intervention as we cannot automatically determine original types

## Running the Migration

### Before You Start
1. **IMPORTANT**: Create a database backup before running the migration
2. Test the migration in a development/staging environment first

### Steps to Run

1. Update your codebase:
   ```bash
   git pull
   npm install
   ```

2. Run the migration script:
   ```bash
   npm run migrate:merge-discovery
   ```
   
   Or manually:
   ```bash
   node scripts/merge-discovery-types.js
   ```

3. The script will:
   - Show a 5-second warning before proceeding
   - Count existing "Discovery Call" and "Discovery Meeting" records
   - Update all records to "Discovery"
   - Verify the migration was successful

### Alternative: SQL Migration
If you prefer to run the SQL migration directly:
```bash
psql -U your_user -d your_database -f supabase/migrations/20250701000000_merge_discovery_types.sql
```

## Verification

After migration, verify that:
1. No "Discovery Call" or "Discovery Meeting" records remain in the database
2. The application dropdowns only show "Discovery" as an option
3. Filtering by "Discovery" works correctly

## Rollback

If you need to rollback:
1. Run: `npm run migrate:rollback-discovery`
2. Follow the instructions provided by the script
3. You'll need to either:
   - Restore from a database backup
   - Use a backup table if you created one
   - Manually update records based on your own criteria

## Impact

- All historical "Discovery Call" and "Discovery Meeting" activities will be shown as "Discovery"
- Reports and analytics will group these together
- No data is lost, only the type label is changed