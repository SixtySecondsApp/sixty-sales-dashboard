# Quick Start: Cleanup Fathom Auto-Synced Tasks

## 🚀 Fast Track (5 Minutes)

### 0. Verify Database Columns (Optional but Recommended)

Run this first to verify your database structure:

```bash
# Copy and paste contents of: test-database-columns.sql
```

This will show you exactly which columns exist in your database.

---

### 1. Check What Needs Cleanup

Run this in Supabase SQL Editor:

```sql
SELECT
    COUNT(*) FILTER (WHERE synced_to_task = true) as auto_synced_items,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as linked_to_tasks,
    COUNT(*) as total_action_items
FROM meeting_action_items;
```

**If `auto_synced_items` = 0**, you're done! No cleanup needed.

**If `auto_synced_items` > 0**, proceed to step 2.

---

### 2. Run the Cleanup

Copy and paste the entire contents of **`cleanup-fathom-tasks-FINAL.sql`** into Supabase SQL Editor and run it.

This will:
- ✅ Create backups automatically
- ✅ Unlink action items from tasks
- ✅ Delete auto-synced tasks
- ✅ Verify success
- ✅ Preserve action items for manual selection

---

### 3. Verify Success

You should see this in the output:

```
✅ SUCCESS: All auto-synced relationships removed
✅ Action items remain available for manual task creation
✅ Auto-synced tasks removed, manual tasks preserved
🎉 CLEANUP COMPLETE
```

---

### 4. Test Manual Workflow

1. Go to any meeting detail page: `/meetings/{meeting-id}`
2. Look for action items from Fathom
3. Click **"Add to Tasks"** on any action item
4. Verify it appears in your task list
5. Click **"Remove from Tasks"** to test removal

---

## ✅ Done!

Users can now manually select which action items to convert to tasks on a meeting-by-meeting basis.

---

## 🆘 Troubleshooting

### Error: Column doesn't exist

The correct column names are:
- ✅ `meeting_action_items.title` (not `content`)
- ✅ `tasks.assigned_to` (not `user_id`)
- ✅ `tasks.created_by` (not `user_id`)
- ✅ `synced_to_task` (boolean)
- ✅ `task_id` (UUID)

**Use `cleanup-fathom-tasks-FINAL.sql` which has all corrected column names!**

### Want to restore deleted tasks?

Check the backup tables:
```sql
SELECT * FROM tasks_backup_20250106;
SELECT * FROM meeting_action_items_backup_20250106;
```

### Need detailed analysis first?

Run `analyze-fathom-tasks.sql` for comprehensive report before cleanup.

---

## 📚 Full Documentation

See `FATHOM_TASKS_CLEANUP_GUIDE.md` for complete details, troubleshooting, and advanced options.
