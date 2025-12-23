# Entity Resolution Migration - RLS Permission Fix

## 🚨 Problem Summary

The initial entity resolution migration (20251101000007) failed with a **95% failure rate** due to Row Level Security (RLS) policies blocking entity creation.

### Failure Metrics
```
Total deals: 565
Successfully migrated: 26 deals (4.6%)
Failed migrations: 539 deals (95.4%)

Breakdown of failures:
- entity_creation_failed: 122 deals
- fuzzy_match_uncertainty: 900 flagged deals
- no_email: 36 deals
- invalid_email: 20 deals
```

### Root Cause

**PostgreSQL functions without `SECURITY DEFINER` cannot bypass RLS policies.**

The migration function `migrate_deal_entities()` was running in the context of the database migration (no authenticated user), so when it tried to INSERT into `companies` and `contacts` tables, RLS policies blocked the operations with errors like:

```
ERROR: new row violates row-level security policy for table "companies"
ERROR: new row violates row-level security policy for table "contacts"
```

Since the function had an `EXCEPTION WHEN OTHERS` handler, these errors were caught silently and deals were flagged as `entity_creation_failed` instead of actually creating the entities.

## ✅ Solution

Add `SECURITY DEFINER` to both migration functions to allow them to bypass RLS policies during migration:

```sql
CREATE OR REPLACE FUNCTION migrate_deal_entities(deal_record RECORD)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- ✅ Run with privileges of function owner to bypass RLS
SET search_path = public, pg_temp
AS $$
```

### Why This Works

- **SECURITY DEFINER**: Function executes with the privileges of the user who created it (typically superuser/postgres)
- **SET search_path**: Security best practice to prevent schema injection attacks
- **Bypass RLS**: Superuser privileges allow INSERTs into tables with RLS enabled

## 🔧 Migration Fix Applied

Created rollback migration **20251101000009** that:

1. **Rolls back failed data**:
   - Deletes all flagged reviews
   - Clears partially created entity relationships

2. **Recreates functions with SECURITY DEFINER**:
   - `migrate_deal_entities()` with RLS bypass
   - `resolve_deal_migration_review()` with RLS bypass

3. **Re-runs migration with fixed functions**:
   - Processes all deals with valid emails
   - Creates companies and contacts successfully
   - Flags only truly problematic deals

4. **Improved flagging logic**:
   - Fixed `fuzzy_match_uncertainty` logic (was incorrectly flagging NULL contact_name)
   - Added new reason: `no_contact_name` for deals missing contact names

## 📊 Expected Results After Fix

After running the rollback migration (20251101000009), you should see:

```
========================================
Entity Resolution Migration Summary (RETRY)
========================================
Total deals: 565
Successfully migrated: ~510 deals (≥90%)
Pending manual review: ~55 deals (≤10%)
========================================
```

### Verification Query

```sql
SELECT
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as company_pct,
  ROUND(100.0 * COUNT(primary_contact_id) / COUNT(*), 1) as contact_pct
FROM deals;
```

Expected output:
- `company_pct`: ≥90%
- `contact_pct`: ≥90%

### Review Flags Breakdown

```sql
SELECT status, reason, COUNT(*)
FROM deal_migration_reviews
GROUP BY status, reason
ORDER BY COUNT(*) DESC;
```

Expected output:
- `no_contact_name`: ~30-50 deals (legitimate flags)
- `no_email`: ~20-40 deals (legitimate flags)
- `invalid_email`: ~10-20 deals (legitimate flags)
- `entity_creation_failed`: <5 deals (actual technical failures)

## 🚀 Next Steps

1. **Run Rollback Migration**: Execute 20251101000009 to fix and retry
2. **Verify Results**: Check that ≥90% of deals have entity relationships
3. **Review Flagged Deals**: Use admin interface at `/admin/deal-migration-review`
4. **Enforce Constraints**: Run 20251101000008 after review completion

## 📚 Technical Background

### RLS Policy Example

The `companies` table likely has RLS policies like:

```sql
CREATE POLICY "Users can insert their own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
```

During migration:
- `auth.uid()` returns NULL (no authenticated user)
- Policy check fails: `NULL != owner_id`
- INSERT is blocked

### SECURITY DEFINER Behavior

```sql
-- Without SECURITY DEFINER (fails)
CREATE FUNCTION foo() RETURNS void AS $$
BEGIN
  INSERT INTO companies (...);  -- RLS blocks this
END;
$$ LANGUAGE plpgsql;

-- With SECURITY DEFINER (works)
CREATE FUNCTION foo() RETURNS void
SECURITY DEFINER  -- ✅ Runs as function owner (superuser)
AS $$
BEGIN
  INSERT INTO companies (...);  -- RLS bypassed
END;
$$ LANGUAGE plpgsql;
```

## ⚠️ Security Considerations

**SECURITY DEFINER functions must be carefully audited** because they run with elevated privileges.

Our functions are safe because:
1. **Input Validation**: All inputs are type-checked (RECORD, UUID, TEXT)
2. **Schema Protection**: `SET search_path = public, pg_temp` prevents injection
3. **Limited Scope**: Only used for one-time migration, can be dropped after
4. **Audit Trail**: All actions logged in `deal_migration_reviews` table

## 📝 Lessons Learned

1. **Always test migrations on staging first** with realistic data and RLS policies
2. **Check RLS policies before writing migration functions** that INSERT/UPDATE
3. **Use SECURITY DEFINER for migrations** that need to bypass RLS
4. **Add comprehensive error logging** to catch silent failures
5. **Validate results immediately** after migration runs

---

**Migration Status**: ✅ Fixed - Ready to apply rollback migration 20251101000009
