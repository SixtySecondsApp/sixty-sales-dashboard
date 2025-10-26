# Migration Status Report

**Generated**: October 26, 2025
**Project**: Sixty Sales Dashboard - Fathom Integration
**Database**: ewtuefzeogytgmsnkpmb.supabase.co

---

## 📊 Current Status: NONE APPLIED

All 16 October 25, 2025 migrations are **PENDING** and need to be applied.

### Migration Status Table

| # | Status | Migration File | Notes |
|---|--------|----------------|-------|
| 1 | ⏳ PENDING | `20251025000001_add_company_source_fields.sql` | Ready to apply |
| 2 | ⏳ PENDING | `20251025000002_add_contact_tracking_fields.sql` | Ready to apply |
| 3 | ⏳ PENDING | `20251025000003_create_meeting_contacts_junction.sql` | Ready to apply |
| 4 | ⏳ PENDING | `20251025000004_add_meeting_id_to_activities.sql` | Ready to apply |
| 5 | ⏳ PENDING | `20251025000005_create_meeting_insights_tables.sql` | Ready to apply |
| 6 | ⏳ PENDING | `20251025000006_create_insights_aggregation_functions.sql` | Ready to apply |
| 7 | ⏳ PENDING | `20251025000007_create_pipeline_sentiment_recommendations.sql` | Ready to apply |
| 8 | ⏳ PENDING | `20251025200000_fathom_action_items_tasks_sync.sql` | Ready to apply |
| 9 | ⏳ PENDING | `20251025201000_task_notification_system.sql` | Ready to apply |
| 10 | ⏳ PENDING | `20251025202000_backfill_action_items_to_tasks.sql` | Ready to apply |
| 11 | ⚠️ **USE FIX** | ~~`20251025203000_action_items_tasks_sync_rls_policies.sql`~~ | **USE: `MIGRATION_FIX_rls_policies.sql`** |
| 12 | ⏳ PENDING | `20251025210000_add_ai_action_item_analysis.sql` | Ready to apply |
| 13 | ⏳ PENDING | `20251025210000_add_transcript_text_column.sql` | Ready to apply |
| 14 | ⏳ PENDING | `20251025210500_ai_analysis_simpler_approach.sql` | Ready to apply |
| 15 | ⏳ PENDING | `20251025_add_fathom_metadata_fields.sql` | Ready to apply |
| 16 | ⚠️ **SPECIAL** | ~~`20251025_create_meeting_assets_bucket.sql`~~ | **2-step process, see below** |

---

## 🎯 What Needs to Be Done

### Phase 1: Database Migrations (20 min)

**Action**: Apply all migrations via Supabase Dashboard SQL Editor

**URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new

**Process**:
1. Apply migrations 1-10 (standard migrations, no issues)
2. Apply migration 11 using **FIXED version** (`MIGRATION_FIX_rls_policies.sql`)
3. Apply migrations 12-15 (standard migrations, no issues)
4. Apply migration 16 using **SPECIAL 2-step process**:
   - Step A: Create storage bucket via Dashboard
   - Step B: Apply `MIGRATION_FIX_storage_bucket.sql`

---

## ⚠️ Critical Fixes Required

### Fix #1: Migration 11 - RLS Policies

**Original File**: `20251025203000_action_items_tasks_sync_rls_policies.sql`
**Issue**: References `deals.user_id` (should be `deals.owner_id`)
**Error**: `column "user_id" does not exist`

**Solution**: Use `MIGRATION_FIX_rls_policies.sql` instead

### Fix #2: Migration 16 - Storage Bucket

**Original File**: `20251025_create_meeting_assets_bucket.sql`
**Issue**: Cannot create storage buckets via SQL
**Error**: `must be owner of table buckets`

**Solution**: 2-step process
1. Create bucket manually via Dashboard
2. Apply `MIGRATION_FIX_storage_bucket.sql` for policies

---

## 📋 Step-by-Step Application Guide

### Migrations 1-10: Standard Application

**For each migration (1-10)**:
1. Open file from: `supabase/migrations/[filename].sql`
2. Copy entire SQL content
3. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
4. Paste SQL
5. Click "Run" (bottom right)
6. Wait for "Success" message
7. Proceed to next migration

---

### Migration 11: Fixed Version

**File**: `MIGRATION_FIX_rls_policies.sql` (NOT the original)

**Steps**:
1. Open: `/Users/andrewbryce/Documents/sixty-sales-dashboard/MIGRATION_FIX_rls_policies.sql`
2. Copy entire SQL content
3. Go to SQL Editor: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
4. Paste SQL
5. Click "Run"
6. Verify: Should see "Success" with no errors

**What it fixes**: Changes `deals.user_id` → `deals.owner_id` on line 115

---

### Migrations 12-15: Standard Application

**For each migration (12-15)**:
1. Open file from: `supabase/migrations/[filename].sql`
2. Copy entire SQL content
3. Go to SQL Editor
4. Paste SQL
5. Click "Run"
6. Wait for "Success"
7. Proceed to next

---

### Migration 16: Special 2-Step Process

#### Step A: Create Storage Bucket (Dashboard)

1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/storage/buckets
2. Click "New Bucket" button
3. Fill in:
   - **Name**: `meeting-assets`
   - **Public**: ✅ YES (check the box)
4. Click "Create Bucket"
5. Verify: Bucket appears in list

#### Step B: Apply RLS Policies (SQL)

**File**: `MIGRATION_FIX_storage_bucket.sql`

1. Open: `/Users/andrewbryce/Documents/sixty-sales-dashboard/MIGRATION_FIX_storage_bucket.sql`
2. Copy entire SQL content
3. Go to SQL Editor: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
4. Paste SQL
5. Click "Run"
6. Verify: Should see "Storage policies created successfully" notice

---

## ✅ Verification After All Migrations

### Quick Verification Query

Run this in SQL Editor after completing all migrations:

```sql
-- Check migration count
SELECT COUNT(*) as migration_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%';
```

**Expected Result**: `16`

### Detailed Verification Queries

```sql
-- 1. Check meetings table has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('transcript_text', 'source', 'first_seen_at');
-- Expected: 3 rows

-- 2. Check meeting_action_items has sync columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN ('task_id', 'sync_status', 'ai_task_type', 'ai_deadline');
-- Expected: 4 rows

-- 3. Check companies table has tracking columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('source', 'first_seen_at');
-- Expected: 2 rows

-- 4. Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('meeting_contacts', 'meeting_insights', 'pipeline_recommendations')
ORDER BY table_name;
-- Expected: 3 rows

-- 5. Check storage bucket exists
SELECT id, name, public
FROM storage.buckets
WHERE id = 'meeting-assets';
-- Expected: 1 row with public = true
```

---

## 🚀 Phase 2: Edge Functions (After Migrations)

Once all 16 migrations are applied successfully, proceed to:

### Deploy 3 Edge Functions

**URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions

1. **NEW**: `analyze-action-item` (AI task categorization)
2. **NEW**: `fathom-backfill-companies` (Company backfill utility)
3. **UPDATE**: `fathom-sync` (Enhanced with new features)

---

## 📊 Progress Tracker

### Phase 1: Database Migrations
- [ ] Migrations 1-10 applied (standard)
- [ ] Migration 11 applied (FIXED version)
- [ ] Migrations 12-15 applied (standard)
- [ ] Migration 16 Step A (bucket created)
- [ ] Migration 16 Step B (policies applied)
- [ ] Verification queries all pass
- [ ] Migration count = 16

### Phase 2: Edge Functions
- [ ] `analyze-action-item` deployed
- [ ] `fathom-backfill-companies` deployed
- [ ] `fathom-sync` updated
- [ ] Edge function secrets verified
- [ ] Test calls successful

### Phase 3: Testing
- [ ] Fathom sync triggered
- [ ] AI analysis working
- [ ] Tasks auto-created
- [ ] Notifications generated
- [ ] Companies matched

---

## 📚 Reference Documentation

- **[QUICK_START.md](QUICK_START.md)** - Quick reference guide
- **[MANUAL_SETUP_STEPS.md](MANUAL_SETUP_STEPS.md)** - Complete detailed walkthrough
- **[MIGRATION_ERRORS_AND_FIXES.md](MIGRATION_ERRORS_AND_FIXES.md)** - Error reference
- **[WHATS_NEW.md](WHATS_NEW.md)** - Feature overview

---

## ⏱️ Time Estimates

- **Migrations 1-10**: ~10 minutes (1 min each)
- **Migration 11 (fixed)**: ~1 minute
- **Migrations 12-15**: ~4 minutes (1 min each)
- **Migration 16 (special)**: ~3 minutes (bucket + SQL)
- **Verification**: ~2 minutes
- **Total Phase 1**: ~20 minutes

---

## 🎯 Ready to Start?

**Current Status**: All migrations are pending and ready to apply

**Next Action**:
1. Open Supabase Dashboard SQL Editor
2. Start with migration #1
3. Follow the step-by-step guide above
4. Use fixed versions for #11 and #16
5. Verify after completing all 16

**Questions?** Check [MIGRATION_ERRORS_AND_FIXES.md](MIGRATION_ERRORS_AND_FIXES.md) for troubleshooting.

---

**Status Report Version**: 1.0
**Last Updated**: October 26, 2025
**Author**: Claude Code
