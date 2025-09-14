-- Migration: Add subtasks support to tasks table
-- Description: Adds parent_task_id field for hierarchical task relationships
-- Date: 2025-01-14

-- 1. Add parent_task_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- 2. Add comment to describe the field
COMMENT ON COLUMN tasks.parent_task_id IS 'References parent task ID for subtasks. NULL for top-level tasks.';

-- 3. Create index for performance on parent_task_id lookups
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id) 
WHERE parent_task_id IS NOT NULL;

-- 4. Create index for finding subtasks of a specific parent
CREATE INDEX idx_tasks_parent_lookup ON tasks(parent_task_id, created_at DESC) 
WHERE parent_task_id IS NOT NULL;

-- 5. Create partial index for top-level tasks (no parent)
CREATE INDEX idx_tasks_top_level ON tasks(assigned_to, created_at DESC) 
WHERE parent_task_id IS NULL;

-- 6. Add check constraint to prevent self-referencing tasks
ALTER TABLE tasks 
ADD CONSTRAINT chk_tasks_no_self_reference 
CHECK (parent_task_id != id);

-- 7. Create function to prevent circular references in task hierarchy
CREATE OR REPLACE FUNCTION prevent_task_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
    current_parent_id UUID;
    check_id UUID;
BEGIN
    -- Only check if parent_task_id is being set
    IF NEW.parent_task_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Start checking from the proposed parent
    current_parent_id := NEW.parent_task_id;
    
    -- Traverse up the hierarchy to check for circular reference
    WHILE current_parent_id IS NOT NULL LOOP
        -- If we find the current task ID in the parent chain, it's circular
        IF current_parent_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected: Task cannot be a subtask of itself or its descendants';
        END IF;
        
        -- Get the parent of the current parent
        SELECT parent_task_id INTO check_id 
        FROM tasks 
        WHERE id = current_parent_id;
        
        current_parent_id := check_id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to prevent circular references
CREATE TRIGGER trigger_prevent_task_circular_reference
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_task_circular_reference();

-- 9. Update Row Level Security (RLS) policies if they exist
-- Note: This assumes existing RLS policies should also apply to subtasks
-- The parent_task_id field will inherit the same access control as the main task

-- 10. Create helper function to get task hierarchy depth
CREATE OR REPLACE FUNCTION get_task_depth(task_id UUID)
RETURNS INTEGER AS $$
DECLARE
    depth INTEGER := 0;
    current_parent_id UUID;
BEGIN
    SELECT parent_task_id INTO current_parent_id 
    FROM tasks 
    WHERE id = task_id;
    
    WHILE current_parent_id IS NOT NULL LOOP
        depth := depth + 1;
        
        SELECT parent_task_id INTO current_parent_id 
        FROM tasks 
        WHERE id = current_parent_id;
        
        -- Safety check to prevent infinite loops (max depth of 10)
        IF depth > 10 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN depth;
END;
$$ LANGUAGE plpgsql;

-- 11. Add constraint to limit hierarchy depth (max 5 levels)
ALTER TABLE tasks 
ADD CONSTRAINT chk_tasks_max_depth 
CHECK (get_task_depth(id) <= 5);

-- Migration verification queries:
-- SELECT * FROM tasks WHERE parent_task_id IS NOT NULL; -- Find all subtasks
-- SELECT * FROM tasks WHERE parent_task_id IS NULL; -- Find all parent tasks
-- SELECT get_task_depth(id) as depth, * FROM tasks ORDER BY depth; -- Check hierarchy depth