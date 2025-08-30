# How to Apply the Pipeline Stage Migration

The migration file has been created but needs to be executed in your Supabase database. Follow these steps:

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy the entire contents of the migration file:
   ```
   supabase/migrations/20241228_add_sql_stage.sql
   ```
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl/Cmd + Enter)
8. You should see success messages for each operation

## Option 2: Using Supabase CLI

If you have Supabase CLI installed and configured:

```bash
# From the project root directory
supabase db push
```

This will apply all pending migrations including the new stage migration.

## Option 3: Manual SQL Execution

You can also run the migration directly:

```bash
# Replace with your actual database URL
psql "postgresql://[your-connection-string]" < supabase/migrations/20241228_add_sql_stage.sql
```

## What This Migration Does

1. **Creates/Updates these stages:**
   - SQL (position 1, green)
   - Opportunity (position 2, purple)
   - Verbal (position 3, orange)
   - Signed (position 4, green)

2. **Removes these deprecated stages:**
   - Lead
   - Meetings Scheduled
   - Negotiation
   - Delivered
   - Signed & Paid

3. **Migrates existing deals:**
   - Deals in "Negotiation" → moved to "Verbal"
   - Deals in "Delivered" → moved to "Signed"
   - Deals in "Signed & Paid" → moved to "Signed"
   - Deals in "Lead" or "Meetings Scheduled" → moved to "SQL"

4. **Creates Smart Task system:**
   - Creates smart_task_templates table
   - Adds automated task generation triggers
   - Sets up admin-only management policies

## Verification

After running the migration:

1. Refresh your browser (clear cache if needed: Ctrl/Cmd + Shift + R)
2. Navigate to the Pipeline page
3. You should see only 4 stages: SQL, Opportunity, Verbal, Signed
4. Check that deals have been properly migrated to their new stages
5. Test that Smart Tasks are generating when you create activities

## Troubleshooting

If you encounter errors:

1. **"Table already exists"** - This is safe to ignore, the migration handles existing tables
2. **Permission errors** - Make sure you're using an admin/service role connection
3. **Deals not migrating** - Check the `stage_migration_notes` column in the deals table for tracking

## Important Notes

- This is a one-way migration
- Backup your database before running if you have production data
- The migration is idempotent (safe to run multiple times)