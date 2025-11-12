# Fathom Auto-Synced Tasks Cleanup Guide

## Overview

This guide helps you clean up tasks that were automatically created from Fathom meeting action items and transition to a manual, meeting-by-meeting task selection system.

## Current System Status

✅ **Automatic syncing is already disabled** (migration: `20251031000001_disable_automatic_action_item_task_sync.sql`)

The system currently:
- Has action items from Fathom meetings in `meeting_action_items` table
- May have auto-synced tasks in `tasks` table that are linked via `task_id` and `synced_to_task = true`
- Supports manual "Add to Tasks" / "Remove from Tasks" buttons in the Meeting Detail UI

## What Needs to Be Cleaned Up

1. **Auto-synced tasks**: Tasks that were automatically created from action items
2. **Sync relationships**: The `task_id`, `synced_to_task`, and `sync_status` fields in `meeting_action_items`

## Step-by-Step Cleanup Process

### Step 1: Analyze Current State

Run the analysis script to understand what you're dealing with:

```bash
# In Supabase SQL Editor, copy and paste the contents of:
analyze-fathom-tasks.sql
```

**OR** use this quick query:

```sql
-- Quick analysis
SELECT
    COUNT(*) FILTER (WHERE synced_to_task = true) as auto_synced_items,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as linked_to_tasks,
    COUNT(*) as total_action_items
FROM meeting_action_items;
```

This will show you:
- How many auto-synced tasks exist
- Which action items are linked to tasks
- Tasks created from meetings
- Action items ready for manual selection

### Step 2: Review the Data

Before deleting anything, review the output from Step 1:

**Key Questions:**
- How many auto-synced tasks exist?
- Are there any manually created tasks you want to preserve?
- Which action items should become tasks?

### Step 3: Run Cleanup (Conservative Approach)

The cleanup script has two modes:

#### Option A: Conservative (Recommended First)
Marks tasks for deletion but doesn't actually delete them:

```sql
-- Add marking column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS marked_for_deletion BOOLEAN DEFAULT false;

-- Mark auto-synced tasks
UPDATE tasks
SET marked_for_deletion = true,
    updated_at = NOW()
WHERE id IN (
    SELECT t.id
    FROM tasks t
    INNER JOIN meeting_action_items mai ON mai.task_id = t.id
    WHERE mai.synced_to_task = true
      AND mai.sync_status = 'synced'
);

-- Review marked tasks
SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.created_at,
    m.title as meeting_title
FROM tasks t
LEFT JOIN meetings m ON m.id = t.meeting_id
WHERE t.marked_for_deletion = true
ORDER BY t.created_at DESC;
```

#### Option B: Full Cleanup (After reviewing) - RECOMMENDED
Actually removes the auto-synced tasks using the simple, safe script:

```bash
# In Supabase SQL Editor, copy and paste the contents of:
simple-cleanup-fathom-tasks.sql
```

This will:
1. Create backups of data being modified
2. Unlink action items from tasks (preserves action items)
3. Delete auto-synced tasks
4. Provide verification at each step
5. Keep backup tables for safety (can be dropped later)

### Step 4: Verify Cleanup

After running cleanup, verify the results:

```sql
-- Check for remaining auto-synced links
SELECT COUNT(*) as remaining_auto_synced
FROM meeting_action_items
WHERE synced_to_task = true;
-- Should return 0

-- Check action items are preserved
SELECT COUNT(*) as total_action_items
FROM meeting_action_items;
-- Should show all action items still exist

-- Check tasks
SELECT
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_tasks
FROM tasks;
-- Meeting tasks should be much lower or zero
```

## New Workflow: Manual Task Selection

After cleanup, users will:

### 1. View Meeting Details
Navigate to any meeting detail page `/meetings/{meeting-id}`

### 2. Review Action Items
Action items from Fathom are displayed in the meeting detail page

### 3. Manually Add to Tasks
Each action item has an "Add to Tasks" button:
- Click to convert the action item into a task
- Task appears in the user's task list
- Action item shows as "synced" with option to remove

### 4. Remove from Tasks (Optional)
If needed, users can click "Remove from Tasks" to:
- Delete the task from their task list
- Keep the action item in the meeting

## UI Features Already in Place

The `MeetingDetail.tsx` already has:

```typescript
// State for action item operations
const [addingToTasksId, setAddingToTasksId] = useState<string | null>(null);
const [removingFromTasksId, setRemovingFromTasksId] = useState<string | null>(null);

// Handlers for manual task creation
const handleAddToTasks = async (actionItem: ActionItem) => { ... }
const handleRemoveFromTasks = async (actionItem: ActionItem) => { ... }
```

Buttons in UI:
- "Add to Tasks" - Creates task from action item
- "Remove from Tasks" - Deletes task, preserves action item

## Benefits of Manual Selection

✅ **User Control**: Users decide which action items become tasks
✅ **Reduced Clutter**: Only important items become tasks
✅ **Meeting-by-Meeting**: Review each meeting and select relevant tasks
✅ **Preserve Context**: Action items remain in meeting for reference
✅ **Clean Task List**: No automatic spam in task lists

## Troubleshooting

### Issue: Some tasks still showing as auto-synced

**Solution:**
```sql
-- Reset all sync flags
UPDATE meeting_action_items
SET
    task_id = NULL,
    synced_to_task = false,
    sync_status = NULL
WHERE synced_to_task = true;
```

### Issue: Want to preserve some auto-synced tasks

**Solution:**
Before cleanup, manually mark tasks to preserve:
```sql
-- Add preservation flag
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS preserve BOOLEAN DEFAULT false;

-- Mark tasks to preserve (update WHERE clause as needed)
UPDATE tasks
SET preserve = true
WHERE status != 'completed'
  AND created_at > NOW() - INTERVAL '7 days';

-- Then modify cleanup script to exclude preserved tasks
```

### Issue: Lost important tasks during cleanup

**Solution:**
Check if you have database backups:
```sql
-- Restore from Supabase automatic backups
-- OR manually recreate tasks using action items:
INSERT INTO tasks (user_id, title, description, meeting_id, created_at)
SELECT
    mai.user_id,
    mai.content,
    'From meeting: ' || m.title,
    mai.meeting_id,
    NOW()
FROM meeting_action_items mai
INNER JOIN meetings m ON m.id = mai.meeting_id
WHERE mai.id = 'ACTION_ITEM_ID';
```

## Files Created

1. **`analyze-fathom-tasks.sql`**: Read-only analysis script (detailed)
2. **`simple-cleanup-fathom-tasks.sql`**: ⭐ Simple, safe cleanup script (RECOMMENDED)
3. **`cleanup-fathom-auto-synced-tasks.sql`**: Alternative cleanup script
4. **`FATHOM_TASKS_CLEANUP_GUIDE.md`**: This guide

**Note:** The column name is `title` not `content` in the `meeting_action_items` table.

## Next Steps

1. ✅ Run `analyze-fathom-tasks.sql` to understand current state
2. ✅ Review the analysis output
3. ✅ Decide: Conservative (mark) or Full (delete) cleanup
4. ✅ Run chosen cleanup approach
5. ✅ Verify cleanup was successful
6. ✅ Test manual "Add to Tasks" workflow
7. ✅ Train users on new manual selection process

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase logs for error messages
3. Verify the automatic trigger is still disabled
4. Check RLS policies on tasks and meeting_action_items tables

## Summary

**Before Cleanup:**
- Auto-synced tasks cluttering task lists
- All action items automatically become tasks
- No user control over what becomes a task

**After Cleanup:**
- Clean slate with manual control
- Users select which action items become tasks
- Meeting-by-meeting review process
- Action items preserved for context
