-- Quick fix for tasks table foreign key constraint issue
-- Run this script in your Supabase SQL editor to fix the deal deletion problem

-- 1. Drop the problematic constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_deal;

-- 2. Ensure the correct constraint exists
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_deal_id_fkey;
ALTER TABLE tasks 
ADD CONSTRAINT tasks_deal_id_fkey 
FOREIGN KEY (deal_id) 
REFERENCES deals(id) 
ON DELETE SET NULL;

-- 3. Verify the constraint was created correctly
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'tasks'
    AND kcu.column_name = 'deal_id';

-- Expected result should show:
-- constraint_name: tasks_deal_id_fkey
-- delete_rule: SET NULL