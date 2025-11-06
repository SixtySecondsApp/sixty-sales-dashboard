# How to Apply Entity Resolution Migrations

## ✅ Critical Issues Fixed

### Migration Files Corrected:
1. **20251101000007_entity_resolution_migration.sql**
   - ❌ **FAILED**: RLS policies blocked entity creation (95% failure rate)
   - ✅ **FIXED**: Added `SECURITY DEFINER` to bypass RLS (see rollback migration below)

2. **20251101000008_enforce_deal_relationships.sql**
   - ✅ **FIXED**: Removed invalid composite FK syntax

### ⚠️ IMPORTANT: Migration 1 Failed Due to RLS
The initial run of migration 20251101000007 failed because:
- Only 26/565 deals got companies (4.6% success)
- Only 29/565 deals got contacts (5.1% success)
- 1,078 deals flagged for review (95% failure rate)

**Root Cause**: PostgreSQL functions without `SECURITY DEFINER` cannot bypass RLS policies. The migration function couldn't INSERT into `companies` or `contacts` tables.

**Solution**: Run rollback migration **20251101000009** to fix and retry.

## 🚀 Step-by-Step Application Guide

### ⚠️ CRITICAL: Run Rollback Migration First

**If you already ran migration 20251101000007**, you MUST run this rollback migration to fix the RLS permission issue.

1. **Open Supabase Dashboard SQL Editor**:
   - Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new

2. **Copy the entire contents of**:
   ```
   /Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/migrations/20251101000009_rollback_and_rerun_entity_resolution.sql
   ```

3. **Paste into SQL Editor** and click **Run**

4. **Review the output** - You should see:
   ```
   ========================================
   Entity Resolution Migration Summary (RETRY)
   ========================================
   Total deals: X
   Successfully migrated: Y (≥90%)
   Pending manual review: Z (≤10%)
   ========================================
   ```

5. **Verify Success** - Run this query:
   ```sql
   SELECT
     COUNT(*) as total_deals,
     COUNT(company_id) as with_company,
     COUNT(primary_contact_id) as with_contact
   FROM deals;
   ```
   - You should see >90% of deals have both company_id and primary_contact_id

---

### Step 1: Apply First Migration (Entity Resolution) - DEPRECATED

**⚠️ DO NOT RUN THIS** - This migration has an RLS permission bug. Use the rollback migration above instead.

<details>
<summary>Original instructions (kept for reference)</summary>

1. **Open Supabase Dashboard SQL Editor**:
   - Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new

2. **Copy the entire contents of**:
   ```
   /Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/migrations/20251101000007_entity_resolution_migration.sql
   ```

3. **Paste into SQL Editor** and click **Run**

4. **Review the output** - You should see:
   ```
   ========================================
   Entity Resolution Migration Summary
   ========================================
   Total deals: X
   Successfully migrated: Y (XX.X%)
   Pending manual review: Z (XX.X%)
   ========================================
   ```

</details>

### Step 2: Review Flagged Deals (Optional but Recommended)

1. **Navigate to Admin Review Interface**:
   - Go to: https://sales.sixtyseconds.video/admin/deal-migration-review

2. **Review deals flagged for manual attention**
   - Deals without valid emails
   - Deals with invalid email formats

3. **Resolve flagged deals**:
   - Select or create companies
   - Select or create contacts
   - Link entities to deals

### Step 3: Verify Migration Success

Run this query in SQL Editor to check status:

```sql
-- Check how many deals have entities
SELECT
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  COUNT(*) FILTER (WHERE company_id IS NULL OR primary_contact_id IS NULL) as needs_attention
FROM deals;

-- Check pending reviews
SELECT status, reason, COUNT(*)
FROM deal_migration_reviews
GROUP BY status, reason
ORDER BY COUNT(*) DESC;
```

**Expected Results**:
- Most deals should have both `company_id` and `primary_contact_id`
- Typically <10% of deals need manual review

### Step 4: Apply Second Migration (Enforce Constraints) ⚠️

**IMPORTANT**: Only apply this AFTER resolving most/all flagged deals!

1. **Verify readiness**:
   ```sql
   -- This should return 0 or very few rows
   SELECT COUNT(*) FROM deals
   WHERE company_id IS NULL OR primary_contact_id IS NULL;
   ```

2. **If ready, copy the entire contents of**:
   ```
   /Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/migrations/20251101000008_enforce_deal_relationships.sql
   ```

3. **Paste into SQL Editor** and click **Run**

4. **Review the output** - You should see:
   ```
   ========================================
   Schema Enforcement Summary
   ========================================
   Total deals: X
   Valid (with proper entities): Y (100%)
   Invalid: 0
   ========================================
   NOT NULL constraints enforced on:
     - company_id
     - primary_contact_id
   Trigger created to validate contact belongs to company
   ========================================
   ```

### Step 5: Verify Schema Enforcement

```sql
-- Verify constraints are active
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'deals'
  AND column_name IN ('company_id', 'primary_contact_id');

-- Should show is_nullable = 'NO' for both columns

-- Check trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_validate_deal_contact_company';

-- Should show trigger on INSERT and UPDATE
```

## 🎯 What the Migrations Do

### Migration 1: Entity Resolution
- Creates `deal_migration_reviews` table for manual review queue
- Enables PostgreSQL fuzzy matching extension (`pg_trgm`)
- Migrates deals with valid emails:
  - Extracts domain from email
  - Finds or creates companies
  - Uses fuzzy matching (>80% similarity) for contacts
  - Links deals to companies and contacts via foreign keys
- Flags problematic deals for manual review:
  - Missing email
  - Invalid email format
  - Failed entity creation
- Provides migration statistics and summary

### Migration 2: Schema Enforcement
- Makes `company_id` and `primary_contact_id` **NOT NULL**
- Creates trigger to validate contact belongs to deal's company
- Adds performance indexes for lookups
- Creates helpful views:
  - `deal_entity_details` - Full deal with company/contact info
  - `deal_migration_review_details` - Admin review interface data
- Updates RLS policies to enforce entity requirements
- Provides validation function: `validate_all_deal_entities()`

## 🔄 Rollback Plan (If Needed)

If you encounter issues:

### Rollback Migration 2 (Schema Enforcement)
```sql
-- Remove NOT NULL constraints
ALTER TABLE deals
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN primary_contact_id DROP NOT NULL;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_validate_deal_contact_company ON deals;
DROP FUNCTION IF EXISTS validate_deal_contact_company();

-- Drop views
DROP VIEW IF EXISTS deal_entity_details;
DROP VIEW IF EXISTS deal_migration_review_details;
```

### Rollback Migration 1 (Entity Resolution)
```sql
-- Remove FKs from deals that were migrated
UPDATE deals
SET company_id = NULL, primary_contact_id = NULL
WHERE id IN (
  SELECT deal_id FROM deal_migration_reviews WHERE status = 'resolved'
);

-- Drop review table
DROP TABLE IF EXISTS deal_migration_reviews CASCADE;

-- Drop migration function
DROP FUNCTION IF EXISTS migrate_deal_entities(RECORD);
DROP FUNCTION IF EXISTS resolve_deal_migration_review(UUID, UUID, UUID, UUID, TEXT);
```

## 📊 Monitoring Queries

### Check entity coverage
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as company_coverage_pct,
  ROUND(100.0 * COUNT(primary_contact_id) / COUNT(*), 1) as contact_coverage_pct
FROM deals
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check fuzzy matching effectiveness
```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(DISTINCT company_id) as unique_companies,
  COUNT(DISTINCT email) as unique_emails,
  ROUND(100.0 * COUNT(DISTINCT email) / COUNT(*), 1) as email_uniqueness_pct
FROM contacts
WHERE created_at > NOW() - INTERVAL '7 days';
```

## ✅ Success Criteria

After both migrations are applied:

- [ ] ✅ 100% of new deals have `company_id` and `primary_contact_id`
- [ ] ✅ 90%+ of legacy deals migrated automatically
- [ ] ✅ <10% of deals flagged for manual review
- [ ] ✅ NOT NULL constraints enforced on both FKs
- [ ] ✅ Trigger validates contact belongs to company
- [ ] ✅ No data integrity violations
- [ ] ✅ Admin review interface accessible at `/admin/deal-migration-review`
- [ ] ✅ New deals created via DealWizard have entities automatically
- [ ] ✅ New deals created via QuickAdd have entities automatically

## 🆘 Support

If you encounter any issues:

1. **Check the error message** - SQL errors will indicate the specific problem
2. **Review the migration file** - Ensure syntax is correct
3. **Check pending migrations** - Use `supabase migration list --linked`
4. **Database backup** - Always have a backup before applying migrations
5. **Contact support** - Provide error message and context

---

**Last Updated**: November 1, 2025
**Migration Files Version**: v1.1 (syntax errors fixed)
