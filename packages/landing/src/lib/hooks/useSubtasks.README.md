# useSubtasks Hook Documentation

A React hook for managing subtasks operations with full CRUD functionality, filtering, and statistics.

## Features

- ✅ **Full CRUD Operations**: Create, read, update, delete subtasks
- ✅ **Move Subtasks**: Transfer subtasks between parent tasks
- ✅ **Bulk Operations**: Update multiple subtasks at once
- ✅ **Real-time Statistics**: Completion percentage, overdue count, priority breakdown
- ✅ **Advanced Filtering**: Filter by status, priority, completion, due dates
- ✅ **Error Handling**: Comprehensive error management with retry mechanisms
- ✅ **TypeScript Support**: Full type safety with existing Task model
- ✅ **Consistent API**: Follows the same patterns as existing `useTasks` hook

## Basic Usage

### Single Parent Task Subtasks

```tsx
import { useSubtasks } from '@/lib/hooks/useSubtasks';

function TaskDetail({ taskId }: { taskId: string }) {
  const {
    subtasks,
    subtaskStats,
    isLoading,
    error,
    createSubtask,
    updateSubtask,
    completeSubtask,
    deleteSubtask
  } = useSubtasks({ 
    parentTaskId: taskId 
  });

  if (isLoading) return <div>Loading subtasks...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Subtasks ({subtaskStats?.total || 0})</h3>
      <p>Progress: {subtaskStats?.completion_percentage || 0}%</p>
      
      {subtasks.map(subtask => (
        <div key={subtask.id}>
          <span>{subtask.title}</span>
          <button onClick={() => completeSubtask(subtask.id)}>
            Complete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### All User Subtasks Across Parent Tasks

```tsx
import { useAllSubtasks } from '@/lib/hooks/useSubtasks';

function MySubtasks() {
  const {
    subtasks,
    subtasksByParent,
    isLoading,
    error
  } = useAllSubtasks('current-user-id');

  return (
    <div>
      <h2>My Subtasks ({subtasks.length})</h2>
      
      {Object.entries(subtasksByParent).map(([parentId, parentSubtasks]) => (
        <div key={parentId}>
          <h4>Parent Task: {parentSubtasks[0]?.parent_task?.title}</h4>
          <ul>
            {parentSubtasks.map(subtask => (
              <li key={subtask.id}>{subtask.title}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

## Advanced Usage

### Filtered Subtasks

```tsx
const {
  subtasks,
  subtaskStats
} = useSubtasks({
  parentTaskId: taskId,
  filters: {
    completed: false,           // Only incomplete subtasks
    priority: ['high', 'urgent'], // High priority only
    overdue_only: true,        // Only overdue subtasks
    assigned_to: 'user-123'    // Specific assignee
  }
});
```

### Creating Subtasks

```tsx
const { createSubtask } = useSubtasks({ parentTaskId });

const handleCreate = async () => {
  try {
    const newSubtask = await createSubtask({
      title: 'Review documentation',
      description: 'Check all examples are working',
      priority: 'high',
      task_type: 'follow_up',
      assigned_to: 'user-123',
      due_date: '2024-12-31T23:59:59Z'
    });
    console.log('Created:', newSubtask);
  } catch (error) {
    console.error('Failed to create subtask:', error);
  }
};
```

### Bulk Operations

```tsx
const { bulkUpdateSubtasks } = useSubtasks({ parentTaskId });

// Mark multiple subtasks as complete
await bulkUpdateSubtasks(['subtask-1', 'subtask-2'], {
  completed: true,
  status: 'completed',
  completed_at: new Date().toISOString()
});

// Change priority for multiple subtasks
await bulkUpdateSubtasks(selectedIds, {
  priority: 'urgent'
});
```

### Moving Subtasks

```tsx
const { moveSubtask } = useSubtasks({ parentTaskId });

// Move subtask to different parent
await moveSubtask('subtask-123', 'new-parent-task-456');
```

## API Reference

### useSubtasks(options)

#### Parameters

- `options.parentTaskId` (string, required): The ID of the parent task
- `options.filters` (SubtaskFilters, optional): Client-side filtering options
- `options.enabled` (boolean, optional): Whether to auto-fetch data (default: true)

#### SubtaskFilters Interface

```typescript
interface SubtaskFilters {
  assigned_to?: string;           // Filter by assignee ID
  status?: Task['status'][];      // Filter by status array
  priority?: Task['priority'][];  // Filter by priority array
  completed?: boolean;            // Filter by completion status
  overdue_only?: boolean;         // Show only overdue subtasks
  due_today?: boolean;           // Show only tasks due today
}
```

#### Return Value

```typescript
{
  // Data
  subtasks: Task[];              // Array of subtasks
  subtaskStats: {                // Statistics object
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
    overdue: number;
    due_today: number;
    high_priority: number;
    completion_percentage: number;
  } | null;
  
  // Loading states
  isLoading: boolean;
  
  // Error states
  error: Error | null;
  
  // Actions
  fetchSubtasks: () => Promise<void>;
  createSubtask: (data: CreateSubtaskData) => Promise<Task>;
  updateSubtask: (id: string, updates: UpdateSubtaskData) => Promise<Task>;
  deleteSubtask: (id: string) => Promise<void>;
  moveSubtask: (id: string, newParentId: string) => Promise<Task>;
  completeSubtask: (id: string) => Promise<Task>;
  uncompleteSubtask: (id: string) => Promise<Task>;
  bulkUpdateSubtasks: (ids: string[], updates: UpdateSubtaskData) => Promise<Task[]>;
}
```

### useAllSubtasks(assignedTo?, enabled?)

#### Parameters

- `assignedTo` (string, optional): User ID to filter subtasks by assignee
- `enabled` (boolean, optional): Whether to auto-fetch data (default: true)

#### Return Value

```typescript
{
  subtasks: Task[];                           // All subtasks
  subtasksByParent: Record<string, Task[]>;   // Grouped by parent task ID
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## Data Types

### CreateSubtaskData

```typescript
interface CreateSubtaskData {
  title: string;                    // Required
  description?: string;
  notes?: string;
  due_date?: string;               // ISO date string
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  task_type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general';
  assigned_to: string;             // Required - User ID
  parent_task_id: string;          // Auto-filled by hook
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
  sync_status?: 'pending_sync' | 'local_only' | 'synced';
}
```

### UpdateSubtaskData

```typescript
interface UpdateSubtaskData {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  task_type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general';
  assigned_to?: string;
  completed?: boolean;
  completed_at?: string;
  parent_task_id?: string;         // Use moveSubtask() instead
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
}
```

## Error Handling

The hook provides comprehensive error handling:

```tsx
const { error, fetchSubtasks } = useSubtasks({ parentTaskId });

if (error) {
  return (
    <div className="error-container">
      <p>Failed to load subtasks: {error.message}</p>
      <button onClick={() => fetchSubtasks()}>
        Retry
      </button>
    </div>
  );
}
```

Common error scenarios:
- **Parent task not found**: When parentTaskId doesn't exist
- **Authentication errors**: When user is not properly authenticated
- **Permission errors**: When user lacks permissions to modify subtasks
- **Network errors**: Connection issues or server problems
- **Validation errors**: Invalid data in create/update operations

## Integration with Task Management

### With existing useTasks hook

```tsx
function TaskManager({ taskId }: { taskId: string }) {
  const { tasks } = useTasks();
  const { subtasks, subtaskStats } = useSubtasks({ parentTaskId: taskId });
  
  const mainTask = tasks.find(t => t.id === taskId);
  
  return (
    <div>
      <h2>{mainTask?.title}</h2>
      <p>Subtasks: {subtaskStats?.total || 0} 
         ({subtaskStats?.completion_percentage || 0}% complete)</p>
      
      {/* Render subtasks */}
    </div>
  );
}
```

### Performance Considerations

- **Lazy loading**: Subtasks are only fetched when `enabled: true` (default)
- **Client-side filtering**: Filters are applied in memory for better performance
- **Optimistic updates**: UI updates immediately, syncs to server in background
- **Error boundaries**: Use React error boundaries for production apps

## Database Schema

The subtask system uses the existing `tasks` table with hierarchical support:

```sql
-- Key fields for subtasks
tasks {
  id: string (primary key)
  parent_task_id: string (foreign key to tasks.id, nullable)
  -- ... all other task fields
}

-- Indexes for performance
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
```

## Testing

The hook includes comprehensive unit tests. Run with:

```bash
npm test -- --testPathPattern=useSubtasks.test.ts
```

Test coverage includes:
- ✅ Basic CRUD operations
- ✅ Filtering functionality  
- ✅ Statistics calculations
- ✅ Error handling
- ✅ Loading states
- ✅ Edge cases (empty data, invalid IDs, etc.)

## Examples

See `src/components/examples/SubtaskExample.tsx` for a complete working example with:
- Subtask creation form
- Statistics display
- Bulk operations
- Real-time updates
- Error handling
- Responsive UI

## Migration from useTasks

If you were previously using `useTasks` for subtask management:

```tsx
// Before
const { tasks: subtasks } = useTasks({ 
  filters: { parent_task_id: parentId } 
});

// After
const { subtasks } = useSubtasks({ 
  parentTaskId: parentId 
});
```

Benefits of migration:
- 🚀 Better performance (targeted queries)
- 📊 Built-in statistics
- 🔄 Specialized subtask operations (move, bulk update)
- 🎯 Cleaner API focused on subtask workflows