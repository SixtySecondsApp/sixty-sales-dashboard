# Archived Migrations

**Archived Date:** 2026-01-08
**Reason:** Migration drift from production database

## Background

These 529 migration files were archived because they had drifted significantly from the actual production database state. Over time, manual changes, hotfixes, and schema modifications were applied directly to production without corresponding migration files, causing the migrations to become out of sync.

## What Happened

1. **Production Schema:** 320 tables, 635 functions, 891 RLS policies, 268 triggers, 1,337 indexes, 525 foreign keys
2. **Migration Files:** 529 files that no longer accurately represent the production schema
3. **Decision:** Create a fresh baseline migration from the actual production state

## New Approach

A new consolidated baseline migration (`00000000000000_baseline.sql`) has been created that:
- Captures the exact production schema state as of 2026-01-08
- Is properly ordered for FK dependencies
- Includes all extensions, types, tables, indexes, policies, functions, and triggers
- Serves as the new "ground truth" for the staging environment

## Reference

These archived migrations are preserved for:
- Historical reference of what changes were intended
- Debugging if issues arise
- Understanding the evolution of the schema

## Files

- Total archived: 529 migration files
- Date range: 2024-03-15 to 2026-01-08
- Original location: `supabase/migrations/`

## Do Not Re-Apply

These migrations should NOT be re-applied to any database. Use the new baseline migration instead.
