# Column Name Fixes for Fathom Tasks Cleanup

## Issues Fixed

### Issue 1: `meeting_action_items.content` does not exist
**Error:** `ERROR: 42703: column mai.content does not exist`

**Fix:** Use `meeting_action_items.title` instead
```sql
-- ❌ WRONG
SELECT mai.content FROM meeting_action_items mai;

-- ✅ CORRECT
SELECT mai.title FROM meeting_action_items mai;
```

### Issue 2: `tasks.user_id` does not exist
**Error:** `ERROR: 42703: column t.user_id does not exist`

**Fix:** Use `tasks.assigned_to` or `tasks.created_by`
```sql
-- ❌ WRONG
SELECT * FROM tasks t
WHERE t.user_id = 'some-uuid';

-- ✅ CORRECT (for assigned tasks)
SELECT * FROM tasks t
WHERE t.assigned_to = 'some-uuid';

-- ✅ CORRECT (for created tasks)
SELECT * FROM tasks t
WHERE t.created_by = 'some-uuid';
```

## Verified Correct Column Names

### `meeting_action_items` table
- ✅ `id` (UUID)
- ✅ `meeting_id` (UUID)
- ✅ `title` (TEXT) - **Not `content`**
- ✅ `assignee_name` (TEXT)
- ✅ `assignee_email` (TEXT)
- ✅ `priority` (TEXT)
- ✅ `category` (TEXT)
- ✅ `deadline_at` (TIMESTAMPTZ)
- ✅ `completed` (BOOLEAN)
- ✅ `ai_generated` (BOOLEAN)
- ✅ `task_id` (UUID) - links to tasks table
- ✅ `synced_to_task` (BOOLEAN)
- ✅ `sync_status` (TEXT)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

### `tasks` table
- ✅ `id` (UUID)
- ✅ `title` (TEXT)
- ✅ `description` (TEXT)
- ✅ `assigned_to` (UUID) - **Not `user_id`**
- ✅ `created_by` (UUID) - **Not `user_id`**
- ✅ `due_date` (TIMESTAMPTZ)
- ✅ `completed` (BOOLEAN)
- ✅ `priority` (TEXT)
- ✅ `status` (TEXT)
- ✅ `task_type` (TEXT)
- ✅ `deal_id` (UUID)
- ✅ `company_id` (UUID)
- ✅ `contact_id` (UUID)
- ✅ `meeting_id` (UUID)
- ✅ `suggestion_id` (UUID)
- ✅ `action_item_id` (UUID)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

## Other Important Column Names

### `meetings` table
- ✅ `owner_user_id` (UUID) - **Not `user_id`**

### `deals` table
- ✅ `owner_id` (UUID) - **Not `user_id`**

### `activities` table
- ✅ `user_id` (UUID) - Correct column name

### `contacts` table
- ✅ `user_id` (UUID) - Correct column name

### `calendar_events` table
- ✅ `user_id` (UUID) - Correct column name

## Updated Files

All SQL scripts have been corrected:

1. ✅ `cleanup-fathom-tasks-FINAL.sql` - **Use this one!**
2. ✅ `analyze-fathom-tasks.sql` - Analysis script
3. ✅ `simple-cleanup-fathom-tasks.sql` - Simple version
4. ✅ `CLAUDE.md` - Documentation updated
5. ✅ `QUICK_START_CLEANUP.md` - Quick reference updated

## Migration Reference

See these files for authoritative schema:
- `supabase/migrations/20250827_create_meetings_tables.sql` - meetings, meeting_action_items
- `supabase/migrations/20250601200000_create_tasks_table.sql` - tasks table
- `supabase/migrations/20251101000001_fix_accept_suggestion_user_columns.sql` - confirms assigned_to usage

## Testing

To verify column names in your database:

```sql
-- Check meeting_action_items columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
ORDER BY ordinal_position;

-- Check tasks columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
```
