# Restore Action Items - Quick Guide

## 🎯 Problem
The cleanup script removed action items from meetings. We need to restore them.

## ✅ Solution: Two Options

### Option 1: Restore from Backup (FASTEST - 30 seconds)

The cleanup script created a backup before making changes. We can restore from that backup.

**Steps:**
1. Open Supabase SQL Editor
2. Copy/paste the entire contents of `restore-action-items.sql`
3. Click Run
4. Look for "✅ RESTORE COMPLETE"

**What it does:**
- Restores all action items from the backup table
- Keeps them unlinked from tasks (as intended)
- Ready for manual task selection

**When to use:**
- You just ran the cleanup script recently
- The backup table still exists (`meeting_action_items_backup_20250106`)

---

### Option 2: Re-fetch from Fathom API (if backup doesn't exist)

If the backup table was deleted or doesn't have all the data, you can re-fetch from Fathom.

**Manual Method:**
1. See `refetch-action-items-from-fathom.sql` for meeting list
2. For each meeting, call the Fathom sync edge function
3. This re-downloads action items from Fathom's API

**Automatic Method (if available):**
- Use Fathom webhook to re-trigger sync
- Or use the Fathom cron sync function

**When to use:**
- Backup doesn't exist
- Need to get latest action items from Fathom
- Want to sync new meetings

---

## 🚀 Quick Start (Recommended)

### Step 1: Try Restore from Backup First

```sql
-- Check if backup exists
SELECT COUNT(*) FROM meeting_action_items_backup_20250106;
```

**If you get a result with count > 0:** Use Option 1 (restore from backup)

**If you get an error "table doesn't exist":** Use Option 2 (re-fetch from Fathom)

### Step 2: Run the Restore

**Option 1 - Restore from Backup:**
```bash
# Copy entire contents of: restore-action-items.sql
# Paste in Supabase SQL Editor
# Click Run
```

**Option 2 - Re-fetch from Fathom:**
```bash
# See: refetch-action-items-from-fathom.sql for instructions
# This requires calling the edge function for each meeting
```

### Step 3: Verify

```sql
-- Check action items are back
SELECT
    m.title,
    COUNT(mai.id) as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
GROUP BY m.id, m.title
ORDER BY m.meeting_start DESC
LIMIT 10;
```

You should see action items for your meetings!

---

## 🔍 Understanding What Happened

### What the Cleanup Script Did
The cleanup script should have:
1. ✅ Created backup of action items
2. ✅ Unlinked action items from tasks
3. ✅ Deleted auto-synced tasks
4. ✅ **Preserved action items** (NOT deleted them)

### What Might Have Gone Wrong
If action items were deleted, it could be:
1. **Cascade Delete**: A foreign key constraint deleted action items when tasks were deleted
2. **Wrong Script**: An older version of the cleanup script was run
3. **Manual Deletion**: Action items were deleted separately

### Good News
- ✅ Backup exists (if cleanup script was run)
- ✅ Fathom still has the data (can re-fetch)
- ✅ Easy to restore!

---

## 📋 Verification Checklist

After restoring, verify these:

- [ ] Action items appear in meetings detail pages
- [ ] Action items are NOT linked to tasks (`task_id` should be NULL)
- [ ] `synced_to_task` flag is `false`
- [ ] Users can click "Add to Tasks" button
- [ ] Creating a task from an action item works

---

## 🛡️ Preventing This in the Future

The cleanup script has been updated to be extra careful:
- Creates backups first
- Only UPDATEs action items (doesn't DELETE)
- Verifies at each step
- Shows clear success/failure messages

For the updated cleanup script, see:
- `cleanup-fathom-tasks-FINAL.sql` (latest version)

---

## 📞 Next Steps

1. **Restore Now**: Run `restore-action-items.sql`
2. **Verify**: Check meetings detail pages
3. **Test**: Try "Add to Tasks" button
4. **Success!** Action items are back and ready for manual selection

---

## 🎉 After Restore

Your system will work like this:

1. **View Meeting** → See action items from Fathom
2. **Review Items** → Decide which are important
3. **Add to Tasks** → Click button for important items
4. **Task Created** → Item appears in your task list
5. **Remove if Needed** → Can unlink with "Remove from Tasks"

This gives you full control over what becomes a task!
