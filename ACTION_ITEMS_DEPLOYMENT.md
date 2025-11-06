# Action Items AI Extraction & Task Sync - Deployment Guide

## Overview
AI-powered extraction of action items from meeting transcripts with automatic sync to sales rep task lists, company/contact linking, and bidirectional completion tracking.

---

## 1. Database Migrations to Run

Run these SQL migrations in order:

### A. Core Tables (if not already present)
```sql
-- user_settings with preferences JSONB
-- File: supabase/migrations/20251026_000000_ensure_user_settings_exists.sql
```

```sql
-- notifications table for in-app alerts
-- File: supabase/migrations/20240109_create_notifications_table.sql
```

```sql
-- slack_integrations and slack_channels
-- File: supabase/migrations/20250905203303_create_slack_integration_tables.sql
```

```sql
-- meeting_action_items AI columns (ai_generated, ai_confidence, assignee_email, deadline_at, etc.)
-- File: supabase/migrations/20251026_add_ai_analysis_columns.sql
```

```sql
-- Fathom action items → tasks sync (triggers, RPCs)
-- File: supabase/migrations/20251025200000_fathom_action_items_tasks_sync.sql
```

```sql
-- Task notifications (immediate on creation, upcoming deadlines, overdue)
-- File: supabase/migrations/20251025201000_task_notification_system.sql
```

### B. New Migration (run this)
```sql
-- Update trigger to populate company_id, contact_id, and map category → task_type
-- File: supabase/migrations/20251027000001_update_task_trigger_for_meeting_context.sql
```

### C. Optional Cron Jobs (enable pg_cron and run once)
```sql
SELECT cron.schedule(
  'notify-upcoming-task-deadlines',
  '0 9 * * *',
  $$SELECT notify_upcoming_task_deadlines()$$
);

SELECT cron.schedule(
  'notify-overdue-tasks-morning',
  '0 9 * * *',
  $$SELECT notify_overdue_tasks()$$
);

SELECT cron.schedule(
  'notify-overdue-tasks-evening',
  '0 17 * * *',
  $$SELECT notify_overdue_tasks()$$
);
```

---

## 2. Edge Functions to Deploy

Deploy these Edge Functions (requires Supabase CLI):

```bash
# Set secrets (if not already set)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set CLAUDE_MODEL=claude-haiku-4-5-20251001

# Deploy extract-action-items (manual "Get Action Items" button)
supabase functions deploy extract-action-items

# Deploy fathom-sync (auto-run on sync with updated AI prompt)
supabase functions deploy fathom-sync
```

---

## 3. How It Works

### Initial Sync (Automatic)
1. User syncs meetings from Fathom via Integrations page.
2. `fathom-sync` Edge Function runs:
   - Fetches transcript from Fathom API.
   - Calls Claude AI to extract action items (3-8 high-confidence, concrete items).
   - Inserts into `meeting_action_items` with `assignee_email`, `deadline_at`, `category`.
3. DB Trigger `auto_create_task_from_action_item`:
   - Checks if `assignee_email` matches an internal user (sales rep).
   - If yes: creates a task in the `tasks` table, populates `company_id` and `contact_id` from the source meeting, maps category to `task_type`.
   - If no (external/prospect): marks as `excluded`, does NOT create task.
4. Another Trigger `notify_task_from_meeting`:
   - Sends in-app notification to the assigned rep immediately.

### Manual Extraction (Button)
1. User clicks "Get Action Items" on a meeting page.
2. Calls `extract-action-items` Edge Function:
   - Re-analyzes the transcript (de-dupes against existing items).
   - Inserts new AI-extracted items.
   - Same trigger flow as above auto-creates tasks for rep items.

### Completion Sync (Bidirectional)
- Rep ticks off item in Meeting page → updates `meeting_action_items.completed` → trigger updates linked `tasks.completed`.
- Rep completes task in Task List → updates `tasks.completed` → trigger updates `meeting_action_items.completed`.

### Notifications
- **Immediate**: When task created from action item (in-app notification via trigger).
- **Day Before**: Cron job runs `notify_upcoming_task_deadlines()` daily at 9am.
- **Day Of / Overdue**: Cron job runs `notify_overdue_tasks()` twice daily (9am, 5pm).
- Respects user preferences in `user_settings.preferences.notifications` (in-app, email, Slack).

---

## 4. AI Extraction Rules

### Only Extract If:
- Clear ownership (assigned to a person/role).
- Concrete action verb (send, schedule, review, provide, decide, sign, etc.).
- Not just an idea or suggestion.
- Confidence ≥ 0.7.

### Categories (Normalized)
- `call` - Phone calls
- `email` - Email tasks
- `meeting` - Schedule/attend meetings
- `follow_up` - General follow-ups
- `proposal` - Send proposals
- `demo` - Product demos
- `general` - Everything else

No "technical", "contract", or "other" categories; they map to `general`.

### Typical Output
- 3–8 action items per sales call.
- Mix of rep and prospect tasks.
- Only rep tasks (internal `assignee_email`) sync to task list.

---

## 5. Task List UI Enhancements

### What's Displayed
For each task from a meeting:
- **Company** (clickable → `/companies/:id`)
- **Contact** (clickable → `/crm/contacts/:id`)
- **Meeting** (clickable → `/meetings/:id`)
- **Play button** (if `timestamp_seconds` + `playback_url` present) → opens Fathom at exact moment.

### Completion
- Checkbox in Task List or Meeting Action Items.
- Changes sync via DB triggers immediately.

---

## 6. Testing Checklist

### End-to-End Flow
1. Sync a meeting with a transcript from Fathom.
   - Verify AI extracts 3–8 action items (check logs or Meeting page).
   - Confirm rep tasks appear in Task List; prospect tasks do NOT.
2. Click "Get Action Items" on a meeting with no items.
   - Should extract and show toast with count or "No Action Items From Meeting".
3. Check a task in Task List:
   - Company/contact/meeting links present and clickable.
   - Play button works if timestamp exists.
4. Toggle completion in Meeting page:
   - Task List reflects completion after refresh (or realtime if subscribed).
5. Toggle completion in Task List:
   - Meeting page reflects completion after refresh.
6. Verify in-app notification was sent when task created.

### SQL Verification
```sql
-- Check tasks created from action items
SELECT 
  t.id, 
  t.title, 
  t.company_id, 
  t.contact_id, 
  t.task_type,
  c.name as company_name,
  co.full_name as contact_name,
  m.title as meeting_title
FROM tasks t
LEFT JOIN companies c ON c.id = t.company_id
LEFT JOIN contacts co ON co.id = t.contact_id
LEFT JOIN meeting_action_items mai ON mai.id = t.meeting_action_item_id
LEFT JOIN meetings m ON m.id = mai.meeting_id
WHERE t.meeting_action_item_id IS NOT NULL
ORDER BY t.created_at DESC
LIMIT 10;

-- Check action items sync status
SELECT 
  mai.title,
  mai.assignee_email,
  mai.sync_status,
  mai.synced_to_task,
  mai.task_id,
  m.title as meeting_title
FROM meeting_action_items mai
JOIN meetings m ON m.id = mai.meeting_id
ORDER BY mai.created_at DESC
LIMIT 10;
```

---

## 7. Configuration

### User Notification Preferences
Users can set preferences at `/settings/notifications`:
- In-app notifications (on/off)
- Email notifications (on/off)
- Slack notifications (on/off)
  - Delivery: DM or Channel
  - Channel ID (if channel delivery)
  - User ID (if DM delivery)

Stored in `user_settings.preferences.notifications` JSONB.

### Environment Variables
Edge Functions need:
- `ANTHROPIC_API_KEY` - Claude AI access
- `CLAUDE_MODEL` - Model name (default: claude-haiku-4-5-20251001)
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

Web app needs:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 8. Troubleshooting

### "No Action Items From Meeting"
- Transcript might be too short or have no commitments.
- AI is being conservative; adjust confidence threshold in `aiAnalysis.ts` if needed.

### Tasks Not Auto-Creating
- Check `meeting_action_items.sync_status`:
  - `excluded` → assignee is external (expected).
  - `failed` → check `sync_error` column.
  - `pending` → trigger didn't fire; run `SELECT sync_meeting_action_items('<meeting_id>')`.

### Completion Not Syncing
- Verify triggers are enabled:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname LIKE '%sync%';
  ```
- Check RLS policies allow updates.

### Missing Company/Contact on Tasks
- Run the backfill SQL in migration `20251027000001`.
- Verify meetings have `company_id` and `primary_contact_id` populated.

---

## 9. Next Steps (Optional Enhancements)

- **Slack Notifications**: Wire user preferences to send Slack DM/channel messages (requires completing `slack-oauth`, `slack-picker`, `notify-immediate` todos).
- **Email Notifications**: Integrate with Supabase SMTP or external provider.
- **Realtime Updates**: Subscribe to `meeting_action_items` and `tasks` changes for instant UI refresh.
- **Analytics**: Track extraction success rate, avg items per meeting, completion rates.

---

**Status**: Core functionality complete and ready to deploy.  
**Deployment**: Run migration `20251027000001`, deploy both Edge Functions, test.











