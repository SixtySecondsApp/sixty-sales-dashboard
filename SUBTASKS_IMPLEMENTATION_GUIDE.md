# Subtasks Implementation Guide

## Overview

This guide documents the database migration and TypeScript interface updates for adding hierarchical subtasks support to the tasks table.

## Database Schema Changes

### 1. New Column: `parent_task_id`
- **Type**: `UUID`
- **Nullable**: Yes (top-level tasks have NULL parent_task_id)
- **Foreign Key**: References `tasks(id)` with CASCADE DELETE
- **Purpose**: Creates parent-child relationships between tasks

### 2. Constraints Added

#### Self-Reference Prevention
```sql
ALTER TABLE tasks 
ADD CONSTRAINT chk_tasks_no_self_reference 
CHECK (parent_task_id != id);
```

#### Hierarchy Depth Limitation (Max 5 levels)
```sql
ALTER TABLE tasks 
ADD CONSTRAINT chk_tasks_max_depth 
CHECK (get_task_depth(id) <= 5);
```

### 3. Circular Reference Prevention

A PostgreSQL trigger function prevents circular references:
- Traverses the hierarchy upward when setting parent_task_id
- Raises exception if circular reference detected
- Automatically triggered on INSERT/UPDATE operations

### 4. Performance Indexes

#### Subtask Lookup Index
```sql
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id) 
WHERE parent_task_id IS NOT NULL;
```

#### Parent-Child Query Optimization
```sql
CREATE INDEX idx_tasks_parent_lookup ON tasks(parent_task_id, created_at DESC) 
WHERE parent_task_id IS NOT NULL;
```

#### Top-Level Tasks Index
```sql
CREATE INDEX idx_tasks_top_level ON tasks(assigned_to, created_at DESC) 
WHERE parent_task_id IS NULL;
```

## TypeScript Interface Updates

### Enhanced Task Interface

```typescript
export interface Task {
  // ... existing fields ...
  
  // Subtasks support
  parent_task_id?: string; // References parent task ID
  
  // Subtask relations (populated via joins)
  parent_task?: Task; // Parent task information
  subtasks?: Task[]; // Child subtasks
  subtask_count?: number; // Count of direct subtasks
  completed_subtask_count?: number; // Count of completed subtasks
  hierarchy_depth?: number; // Depth in the task hierarchy
}
```

### New Computed Fields

- **`parent_task`**: Full parent task object (join required)
- **`subtasks`**: Array of direct child tasks (join required)
- **`subtask_count`**: Total number of direct subtasks
- **`completed_subtask_count`**: Number of completed subtasks
- **`hierarchy_depth`**: Task's depth in hierarchy (0 = top-level)

## Database Functions

### `get_task_depth(task_id UUID)`
Returns the hierarchy depth of a task:
- **Returns**: INTEGER (0 = top-level, 1 = first subtask level, etc.)
- **Purpose**: Used for depth constraint validation
- **Safety**: Prevents infinite loops with max depth check

## Implementation Considerations

### 1. Cascade Deletion Behavior
- When a parent task is deleted, all subtasks are automatically deleted
- This maintains data integrity and prevents orphaned subtasks
- Consider implementing soft deletes if cascade behavior is too aggressive

### 2. Permission Inheritance
- Subtasks inherit access permissions from parent task
- Existing RLS policies automatically apply to subtasks
- Parent task permissions control subtask visibility

### 3. Completion Logic Options

#### Option A: Independent Completion
- Subtasks complete independently of parent
- Parent completion doesn't affect subtasks

#### Option B: Dependent Completion  
- Parent cannot complete until all subtasks complete
- Completing parent auto-completes all subtasks

#### Option C: Hybrid Approach (Recommended)
- Allow independent completion by default
- Optional "block parent completion" flag on subtasks
- UI warnings when parent completed with incomplete subtasks

### 4. Performance Considerations

#### Efficient Queries for Subtask Loading
```sql
-- Load task with direct subtasks
SELECT t.*, 
       COUNT(st.id) as subtask_count,
       COUNT(CASE WHEN st.completed = true THEN 1 END) as completed_subtask_count
FROM tasks t
LEFT JOIN tasks st ON st.parent_task_id = t.id
WHERE t.id = $1
GROUP BY t.id;

-- Load full hierarchy (recursive CTE)
WITH RECURSIVE task_hierarchy AS (
  SELECT *, 0 as depth 
  FROM tasks 
  WHERE id = $1
  
  UNION ALL
  
  SELECT t.*, th.depth + 1
  FROM tasks t
  JOIN task_hierarchy th ON t.parent_task_id = th.id
)
SELECT * FROM task_hierarchy ORDER BY depth, created_at;
```

## Frontend Implementation Patterns

### 1. Task Tree Component
```typescript
interface TaskTreeProps {
  rootTasks: Task[];
  onTaskUpdate: (task: Task) => void;
  maxDepth?: number;
}
```

### 2. Subtask Creation
```typescript
const createSubtask = async (parentId: string, subtaskData: Partial<Task>) => {
  const subtask: Partial<Task> = {
    ...subtaskData,
    parent_task_id: parentId,
    assigned_to: parentTask.assigned_to, // Inherit assignment by default
  };
  
  return await taskService.create(subtask);
};
```

### 3. Hierarchy Navigation
```typescript
const getTaskBreadcrumb = (task: Task): Task[] => {
  const breadcrumb: Task[] = [task];
  let current = task.parent_task;
  
  while (current) {
    breadcrumb.unshift(current);
    current = current.parent_task;
  }
  
  return breadcrumb;
};
```

## API Endpoints to Implement

### GET `/api/tasks/:id/subtasks`
- Returns direct subtasks of a parent task
- Supports pagination and filtering
- Includes completion statistics

### GET `/api/tasks/:id/hierarchy`  
- Returns full task hierarchy (parent + all descendants)
- Useful for task tree views
- Includes depth information

### POST `/api/tasks/:id/subtasks`
- Creates new subtask under specified parent
- Validates hierarchy constraints
- Returns created subtask with parent context

### PUT `/api/tasks/:id/move`
- Moves task to different parent (or to top-level)
- Validates circular references
- Updates hierarchy relationships

## Migration Checklist

- [ ] Run the SQL migration script
- [ ] Update TypeScript interfaces
- [ ] Add subtask creation UI components
- [ ] Implement task tree/hierarchy display
- [ ] Update task completion logic (if using dependent completion)
- [ ] Add subtask-specific API endpoints
- [ ] Update existing task queries to handle parent_task_id
- [ ] Test circular reference prevention
- [ ] Test cascade deletion behavior
- [ ] Update documentation and user guides

## Testing Scenarios

### 1. Basic Functionality
- [ ] Create subtask under parent task
- [ ] Edit subtask independently
- [ ] Complete subtask without affecting parent
- [ ] Delete subtask without affecting parent

### 2. Hierarchy Management
- [ ] Create multi-level hierarchy (up to 5 levels)
- [ ] Move task between parents
- [ ] Move parent task (with subtasks)
- [ ] Convert top-level task to subtask

### 3. Edge Cases
- [ ] Attempt to create circular reference (should fail)
- [ ] Attempt to exceed max depth (should fail)  
- [ ] Delete parent with subtasks (subtasks should cascade delete)
- [ ] Performance with large subtask trees (100+ subtasks)

### 4. Permission Testing
- [ ] Subtask visibility follows parent permissions
- [ ] User can only edit subtasks they have access to
- [ ] Admin can see all subtasks in hierarchy

## Security Considerations

1. **Row Level Security**: Ensure RLS policies cover parent_task_id relationships
2. **Permission Inheritance**: Validate that subtask access controls follow parent task permissions  
3. **Bulk Operations**: Prevent unauthorized bulk creation of subtasks
4. **Hierarchy Traversal**: Limit recursive queries to prevent DoS attacks

---

## Files Modified

1. **`add-task-subtasks-support.sql`** - Database migration script
2. **`src/lib/database/models.ts`** - Updated Task interface
3. **`SUBTASKS_IMPLEMENTATION_GUIDE.md`** - This implementation guide

The migration provides a solid foundation for hierarchical task management while maintaining data integrity and performance.