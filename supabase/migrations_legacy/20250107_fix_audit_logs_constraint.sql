-- Fix audit_logs unique constraint to prevent duplicate key violations
-- The issue: Multiple updates to the same record can happen within the same millisecond,
-- causing duplicate key violations on (table_name, record_id, changed_at)

-- Drop the old unique constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_table_record_idx;

-- Create a new unique index that includes the id to make it truly unique
-- This allows multiple audit entries for the same record at the same timestamp
CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_unique_idx
ON audit_logs(table_name, record_id, changed_at, id);

-- Add a comment explaining the change
COMMENT ON INDEX audit_logs_unique_idx IS
'Unique index allowing multiple audit entries for the same record at the same timestamp by including the id column';
