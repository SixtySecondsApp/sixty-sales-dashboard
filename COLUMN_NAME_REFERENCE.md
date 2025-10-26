# Column Name Reference - Common Migration Errors

This document lists the actual column names in tables to prevent migration errors.

## ⚠️ Common Column Name Mistakes

### meeting_action_items Table
**Actual columns**:
- ✅ `deadline_at` (NOT `due_date`)
- ❌ NO `notes` column (doesn't exist)
- ❌ NO `description` column (doesn't exist)
- ✅ `title` (correct)
- ✅ `assignee_email` (correct)
- ✅ `assignee_name` (correct)
- ✅ `priority` (correct)
- ✅ `completed` (correct)

**Full schema**:
```sql
CREATE TABLE meeting_action_items (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  title TEXT NOT NULL,
  assignee_name TEXT,
  assignee_email TEXT,
  priority TEXT,
  category TEXT,
  deadline_at TIMESTAMPTZ,  -- NOT due_date!
  completed BOOLEAN DEFAULT FALSE,
  ai_generated BOOLEAN DEFAULT FALSE,
  timestamp_seconds INTEGER,
  playback_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### deals Table
**Actual columns**:
- ✅ `owner_id` (NOT `user_id`)
- ✅ `stage_id` (UUID reference, NOT `stage` text field)
- ✅ `status` (text: 'active', 'won', 'lost')
- ✅ `company_id` (correct)

**Common mistakes**:
```sql
-- WRONG:
WHERE user_id = auth.uid()
WHERE stage NOT IN ('Signed', 'Lost')

-- CORRECT:
WHERE owner_id = auth.uid()
WHERE status = 'active'  -- or status NOT IN ('won', 'lost')
```

**Stage vs Status**:
- `stage_id` = UUID reference to `deal_stages` table (pipeline position)
- `status` = Deal outcome ('active', 'won', 'lost')

### meetings Table
**Actual columns**:
- ✅ `owner_user_id` (NOT `user_id`)
- ✅ `company_id` (correct)
- ✅ `primary_contact_id` (correct)

**Common mistake**:
```sql
-- WRONG:
WHERE user_id = auth.uid()

-- CORRECT:
WHERE owner_user_id = auth.uid()
```

## 📋 Migration Fixes Applied

### Migration #7 (Pipeline Recommendations)
**Errors fixed**:
1. `deals.user_id` → `deals.owner_id` (line 105)
2. `GET DIAGNOSTICS v_deal_updated = ROW_COUNT > 0` → Split into two statements (line 257)

### Migration #8 (Tasks Sync)
**Errors fixed**:
1. Missing `task_id` column declaration (line 16)
2. `v_action_item.notes` → `NULL` (no notes field exists)
3. `v_action_item.due_date` → `v_action_item.deadline_at`
4. Trigger references to non-existent columns removed

### Migration #11 (RLS Policies)
**Errors fixed**:
1. `deals.user_id` → `deals.owner_id` (line 115)

## 🎯 Quick Reference

When writing migrations that reference:

**meeting_action_items**:
- Use `deadline_at` not `due_date`
- No `notes` or `description` fields exist
- Only sync: title, priority, deadline_at, completed, assignee_email

**deals**:
- Use `owner_id` not `user_id`

**meetings**:
- Use `owner_user_id` not `user_id`
- Use `meeting_start` and `meeting_end` NOT `start_time` and `end_time`
- Use `fathom_recording_id` (required, unique)
- Use `share_url` for Fathom video links (NOT `fathom_video_url`)
- Use `calls_url` for Fathom app URL

**contacts**:
- Use `first_name` and `last_name` NOT `name`
- Use `owner_id` NOT `user_id`
- Has `source` and `first_seen_at` for tracking

**tasks**:
- Use `created_by` NOT `user_id` (common mistake!)
- Use `assigned_to` for the assignee
- Use `due_date` (tasks table has this column)
- Has `description` field (tasks table has this)

## 📝 Verification Query

Run this to verify column names before writing migrations:

```sql
-- Check meeting_action_items columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
ORDER BY ordinal_position;

-- Check deals columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deals'
ORDER BY ordinal_position;

-- Check meetings columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;
```
