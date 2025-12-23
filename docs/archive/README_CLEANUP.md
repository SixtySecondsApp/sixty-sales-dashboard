# Fathom Tasks Cleanup - README

## 🎯 Goal
Remove auto-synced tasks from Fathom meetings and enable manual, meeting-by-meeting task selection.

## 📋 What You Need

1. Access to Supabase SQL Editor
2. 5 minutes of time
3. These files (all created and ready):
   - ✅ `test-database-columns.sql` - Verify your database structure
   - ✅ `cleanup-fathom-tasks-FINAL.sql` - The cleanup script
   - ✅ `QUICK_START_CLEANUP.md` - Step-by-step guide

## 🚀 Quick Start (3 Steps)

### Step 1: Test Your Database (30 seconds)
```sql
-- Run this in Supabase SQL Editor:
-- Copy/paste contents of: test-database-columns.sql

-- This will show you:
-- - What columns exist in meeting_action_items
-- - What columns exist in tasks
-- - How many auto-synced items you have
```

### Step 2: Run the Cleanup (1 minute)
```sql
-- Copy/paste entire contents of: cleanup-fathom-tasks-FINAL.sql
-- Then click "Run"

-- This will:
-- ✅ Create automatic backups
-- ✅ Unlink action items from tasks
-- ✅ Delete auto-synced tasks
-- ✅ Show verification at each step
```

### Step 3: Verify Success (30 seconds)
Look for these messages in the output:
```
✅ SUCCESS: All auto-synced relationships removed
✅ Action items remain available for manual task creation
🎉 CLEANUP COMPLETE
```

## ✅ What Happens Next?

### Before Cleanup
- ❌ Every Fathom action item automatically becomes a task
- ❌ Users' task lists are cluttered
- ❌ No control over what becomes a task

### After Cleanup
- ✅ Users manually select which action items to convert
- ✅ Clean task lists
- ✅ Meeting-by-meeting review process
- ✅ All action items preserved for context

### How Users Create Tasks Now

1. Go to a meeting detail page: `/meetings/{meeting-id}`
2. Review the action items from that meeting
3. Click "Add to Tasks" on important items
4. The action item becomes a task in their task list
5. Click "Remove from Tasks" if needed

## 🔧 Files Reference

| File | Purpose | When to Use |
|------|---------|-------------|
| `test-database-columns.sql` | Verify database structure | Before cleanup (optional) |
| `cleanup-fathom-tasks-FINAL.sql` | ⭐ Main cleanup script | To perform cleanup |
| `QUICK_START_CLEANUP.md` | Step-by-step guide | For detailed instructions |
| `COLUMN_NAME_FIXES.md` | Column name reference | If you get column errors |
| `FATHOM_TASKS_CLEANUP_GUIDE.md` | Complete documentation | For full details |
| `analyze-fathom-tasks.sql` | Detailed analysis | For deep dive analysis |

## 🆘 Troubleshooting

### "Column does not exist" Error

**Problem:** SQL mentions a column that doesn't exist

**Solution:**
1. Run `test-database-columns.sql` to see actual column names
2. Use `cleanup-fathom-tasks-FINAL.sql` which has corrections
3. See `COLUMN_NAME_FIXES.md` for column reference

### Want to Restore Deleted Tasks

**Solution:**
```sql
-- Check backups
SELECT * FROM tasks_backup_20250106;
SELECT * FROM meeting_action_items_backup_20250106;

-- Restore if needed (replace with actual task IDs)
INSERT INTO tasks
SELECT * FROM tasks_backup_20250106
WHERE id IN ('task-id-1', 'task-id-2');
```

### No Auto-Synced Items Found

**Good news!** Your database is already clean. No cleanup needed.

```sql
-- This should return 0:
SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true;
```

## 📊 Database Column Reference

### ✅ Correct Column Names

**meeting_action_items:**
- `title` (NOT `content`)
- `synced_to_task` (boolean)
- `task_id` (UUID)

**tasks:**
- Tasks table might use different column names depending on migration version:
  - `assigned_to` (most common)
  - `created_by` (most common)
  - `owner_id` (some versions)
  - NOT `user_id`

Use `test-database-columns.sql` to verify your specific database!

## ✨ Key Points

- ✅ **Safe:** Creates automatic backups before any changes
- ✅ **Preserves:** All action items remain for manual selection
- ✅ **Clean:** Removes only auto-synced tasks
- ✅ **Verified:** Shows success/failure at each step
- ✅ **Reversible:** Backups allow restoration if needed

## 📞 Need Help?

1. Check `COLUMN_NAME_FIXES.md` for column name issues
2. See `FATHOM_TASKS_CLEANUP_GUIDE.md` for detailed help
3. Run `test-database-columns.sql` to verify your database structure

## 🎉 Success Criteria

You'll know it worked when:
1. SQL script completes without errors
2. You see "🎉 CLEANUP COMPLETE" message
3. Auto-synced count = 0 in verification query
4. Users can manually add tasks from meeting detail pages

---

**Ready to start?** → Open `QUICK_START_CLEANUP.md` for step-by-step instructions!
