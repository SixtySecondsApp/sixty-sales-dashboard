/*
  # Fix Tasks Deal Foreign Key Constraint
  
  Fix the foreign key constraint between tasks and deals table to allow 
  deal deletion by setting deal_id to NULL instead of preventing deletion.
  
  Issue: The constraint "fk_tasks_deal" is preventing deal deletion.
  Solution: Drop the problematic constraint and recreate it with ON DELETE SET NULL.
*/

-- First, let's check if the constraint exists and drop it
DO $$
BEGIN
    -- Drop the problematic foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_tasks_deal' 
        AND table_name = 'tasks'
    ) THEN
        ALTER TABLE tasks DROP CONSTRAINT fk_tasks_deal;
        RAISE NOTICE 'Dropped existing fk_tasks_deal constraint';
    END IF;
    
    -- Also check for any other deal_id constraints that might be problematic
    FOR rec IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'tasks' 
        AND kcu.column_name = 'deal_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name != 'tasks_deal_id_fkey'
    ) LOOP
        EXECUTE 'ALTER TABLE tasks DROP CONSTRAINT ' || rec.constraint_name;
        RAISE NOTICE 'Dropped constraint: %', rec.constraint_name;
    END LOOP;
END $$;

-- Ensure the deal_id column exists (it should already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name = 'deal_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN deal_id UUID;
        RAISE NOTICE 'Added deal_id column to tasks table';
    END IF;
END $$;

-- Create the correct foreign key constraint with ON DELETE SET NULL
DO $$
BEGIN
    -- Only add the constraint if it doesn't already exist with the correct behavior
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        JOIN information_schema.table_constraints tc 
        ON rc.constraint_name = tc.constraint_name
        JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'tasks' 
        AND kcu.column_name = 'deal_id'
        AND rc.delete_rule = 'SET NULL'
    ) THEN
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_deal_id_fkey 
        FOREIGN KEY (deal_id) 
        REFERENCES deals(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Added correct foreign key constraint: tasks_deal_id_fkey with ON DELETE SET NULL';
    ELSE
        RAISE NOTICE 'Correct foreign key constraint already exists';
    END IF;
END $$;

-- Recreate the index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id) WHERE deal_id IS NOT NULL;

-- Add a comment to document the fix
COMMENT ON CONSTRAINT tasks_deal_id_fkey ON tasks IS 
'Foreign key to deals table with ON DELETE SET NULL to allow deal deletion while preserving task records';

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Tasks table foreign key constraint fix completed successfully';
END $$;