# Migration Errors and Fixes

**Date**: October 26, 2025
**Status**: Known issues documented with fixes provided

---

## ⚠️ Known Migration Issues

### Issue #1: Storage Bucket Creation (Migration #16)

**File**: `20251025_create_meeting_assets_bucket.sql`

**Error**:
```
ERROR: 42501: must be owner of table buckets
```

**Cause**: Storage buckets cannot be created via SQL migrations - they require Dashboard creation.

**Fix**:
1. **Create bucket manually** via Dashboard:
   - Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/storage/buckets
   - Click "New Bucket"
   - Name: `meeting-assets`
   - Public: YES (check the box)
   - Click "Create Bucket"

2. **Then apply fixed SQL**:
   - Use: `MIGRATION_FIX_storage_bucket.sql`
   - This creates the RLS policies only

---

### Issue #2: Wrong Column Name (Migration #11)

**File**: `20251025203000_action_items_tasks_sync_rls_policies.sql`

**Error**:
```
ERROR: 42703: column "user_id" does not exist
HINT: Perhaps you meant to reference the column "deals.owner_id" or the column "tasks.owner_id".
```

**Cause**: Line 115 references `deals.user_id` but the correct column name is `deals.owner_id`.

**Fix**:
- **Do NOT use** the original migration file
- **Use instead**: `MIGRATION_FIX_rls_policies.sql`
- Fixed line 115: `SELECT id FROM deals WHERE owner_id = auth.uid()`

**Original (WRONG)**:
```sql
SELECT id FROM deals WHERE user_id = auth.uid()
```

**Fixed (CORRECT)**:
```sql
SELECT id FROM deals WHERE owner_id = auth.uid()
```

---

## 📋 Migration Checklist with Fixes

### Correct Order (Use Fixed Versions)

1. ✅ `20251025000001_add_company_source_fields.sql`
2. ✅ `20251025000002_add_contact_tracking_fields.sql`
3. ✅ `20251025000003_create_meeting_contacts_junction.sql`
4. ✅ `20251025000004_add_meeting_id_to_activities.sql`
5. ✅ `20251025000005_create_meeting_insights_tables.sql`
6. ✅ `20251025000006_create_insights_aggregation_functions.sql`
7. ✅ `20251025000007_create_pipeline_sentiment_recommendations.sql`
8. ✅ `20251025200000_fathom_action_items_tasks_sync.sql`
9. ✅ `20251025201000_task_notification_system.sql`
10. ✅ `20251025202000_backfill_action_items_to_tasks.sql`
11. ⚠️ **USE FIX**: `MIGRATION_FIX_rls_policies.sql` (NOT `20251025203000`)
12. ✅ `20251025210000_add_ai_action_item_analysis.sql`
13. ✅ `20251025210000_add_transcript_text_column.sql`
14. ✅ `20251025210500_ai_analysis_simpler_approach.sql`
15. ✅ `20251025_add_fathom_metadata_fields.sql`
16. ⚠️ **SPECIAL**: `MIGRATION_FIX_storage_bucket.sql` (create bucket first!)

---

## 🔧 Fixed Migration Files

### Files Created

1. **`MIGRATION_FIX_rls_policies.sql`**
   - Fixes: `deals.user_id` → `deals.owner_id`
   - Use instead of: `20251025203000_action_items_tasks_sync_rls_policies.sql`

2. **`MIGRATION_FIX_storage_bucket.sql`**
   - Fixes: Storage bucket creation via Dashboard
   - Use instead of: `20251025_create_meeting_assets_bucket.sql`
   - Manual step required: Create bucket first

---

## 🎯 Correct Application Order

### Step-by-Step Process

**1. Apply Migrations 1-10 (no issues)**
```
Copy SQL from each file → Paste in SQL Editor → Run
```

**2. Migration 11 - Use Fixed Version**
```
⚠️ DO NOT USE: 20251025203000_action_items_tasks_sync_rls_policies.sql
✅ USE INSTEAD: MIGRATION_FIX_rls_policies.sql
```

**3. Apply Migrations 12-15 (no issues)**
```
Copy SQL from each file → Paste in SQL Editor → Run
```

**4. Migration 16 - Special Handling**
```
⚠️ STEP A: Create storage bucket manually
  - Dashboard → Storage → New Bucket
  - Name: meeting-assets
  - Public: YES

⚠️ STEP B: Apply fixed SQL
  - Use: MIGRATION_FIX_storage_bucket.sql
  - Creates RLS policies only
```

---

## 🐛 Other Common Errors

### "relation already exists"

**Error**:
```
ERROR: 42P07: relation "table_name" already exists
```

**Solution**:
- Migrations are idempotent (safe to re-run)
- If table/column exists, it means migration was partially applied
- Check if the object exists:
```sql
-- For table
SELECT * FROM information_schema.tables WHERE table_name = 'table_name';

-- For column
SELECT * FROM information_schema.columns
WHERE table_name = 'table_name' AND column_name = 'column_name';
```
- If exists, skip that specific CREATE and run the rest

---

### "constraint already exists"

**Error**:
```
ERROR: 42710: constraint "constraint_name" already exists
```

**Solution**:
- Use `IF NOT EXISTS` clause in constraint creation
- Or drop constraint first: `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...`

---

### "function already exists"

**Error**:
```
ERROR: 42723: function "function_name" already exists
```

**Solution**:
- Use `CREATE OR REPLACE FUNCTION` instead of `CREATE FUNCTION`
- All fixed migrations already use `CREATE OR REPLACE`

---

## ✅ Verification After Fixes

### Verify All Migrations Applied

```sql
-- Check migration count
SELECT COUNT(*) as migration_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%';
-- Expected: 16 (including fixed versions)

-- List all Oct 25 migrations
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%'
ORDER BY version;
```

### Verify Schema Changes

```sql
-- 1. Check meetings table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('transcript_text', 'source', 'first_seen_at');
-- Expected: 3 rows

-- 2. Check meeting_action_items table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN ('task_id', 'ai_task_type', 'sync_status');
-- Expected: 3 rows

-- 3. Check companies table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('source', 'first_seen_at');
-- Expected: 2 rows

-- 4. Check storage bucket exists
SELECT id, name, public
FROM storage.buckets
WHERE id = 'meeting-assets';
-- Expected: 1 row with public = true
```

### Verify RLS Policies

```sql
-- Check meeting_action_items policies
SELECT policyname
FROM pg_policies
WHERE tablename = 'meeting_action_items'
ORDER BY policyname;
-- Expected: 3 policies

-- Check tasks policies
SELECT policyname
FROM pg_policies
WHERE tablename = 'tasks'
AND policyname LIKE '%meetings%';
-- Expected: 1 policy with meetings integration
```

---

## 📝 Summary

**Total Migrations**: 16
**Issues Found**: 2
**Fixed Files Created**: 2

**Migration Success Checklist**:
- [ ] 10 migrations applied successfully (1-10)
- [ ] Fixed RLS policies applied (11)
- [ ] 4 migrations applied successfully (12-15)
- [ ] Storage bucket created via Dashboard
- [ ] Storage bucket policies applied (16)
- [ ] All 16 migrations show in schema_migrations table
- [ ] All verification queries pass

---

## 🚀 Next Steps

After fixing and applying all migrations:

1. **Deploy Edge Functions**
   - analyze-action-item (NEW)
   - fathom-backfill-companies (NEW)
   - fathom-sync (UPDATE)

2. **Verify Edge Functions**
   - Check secrets are configured
   - Test with sample requests

3. **Test Full Integration**
   - Trigger Fathom sync
   - Verify AI analysis
   - Check notifications created

---

**Document Version**: 1.0
**Last Updated**: October 26, 2025
**Author**: Claude Code
