# Fix Audit Logs Constraint Issue

## Problem
Task completion fails with error: **"duplicate key value violates unique constraint 'audit_logs_table_record_idx'"**

This happens because the unique constraint `(table_name, record_id, changed_at)` doesn't allow multiple audit log entries for the same record at the same timestamp (millisecond precision).

## Solution
Apply the migration `20250107_fix_audit_logs_constraint.sql` which:
1. Drops the old unique constraint
2. Creates a new unique index that includes the `id` column
3. This allows multiple audit entries at the same timestamp (which is necessary when tasks are updated rapidly)

## How to Apply

### Option 1: Using Supabase CLI
```bash
npx supabase db push
```

### Option 2: Using Supabase Dashboard SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20250107_fix_audit_logs_constraint.sql`
3. Paste and run in SQL Editor

### Option 3: Direct SQL
Run this SQL directly in your database:

```sql
-- Fix audit_logs unique constraint to prevent duplicate key violations
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_table_record_idx;

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_unique_idx
ON audit_logs(table_name, record_id, changed_at, id);

COMMENT ON INDEX audit_logs_unique_idx IS
'Unique index allowing multiple audit entries for the same record at the same timestamp by including the id column';
```

## After Applying
Once the migration is applied:
- ✅ Task completion will work without errors
- ✅ Multiple updates to the same task can happen rapidly
- ✅ Audit trail still captures all changes
- ✅ No duplicate key violations

## Testing
1. Go to a meeting page
2. Add an action item to tasks
3. Click the task completion checkbox
4. Should see "Task marked as complete" without errors
5. Click again to mark incomplete
6. Should work smoothly with no constraint violations
