# Fathom Integration Setup Guide

**Date**: October 26, 2025
**PRs Merged**: #35, #36, #37, #38
**Status**: Pre-Testing Setup Required

---

## 🎯 Overview

This guide walks through the setup required after pulling the latest Fathom integration changes. Four major features have been merged:

1. **Company Enrichment & Matching** - Auto-link companies from meeting attendees
2. **Meeting Summaries & Transcripts** - Always fetch full meeting details
3. **Action Items → Tasks Sync** - Bidirectional sync with notifications
4. **AI Task Analysis** - Claude Haiku 4.5 categorization and deadline suggestions

---

## ⚠️ Prerequisites

Before starting, ensure you have:
- [ ] Access to Supabase Dashboard (https://app.supabase.com/project/ewtuefzeogytgmsnkpmb)
- [ ] Admin access to the project
- [ ] Anthropic API key (for AI features)
- [ ] Supabase CLI installed (optional, for local deployment)

---

## 📋 Setup Checklist

### Step 1: Database Migrations ✅

**Location**: Supabase Dashboard → Database → Migrations

**Action**: Run the following migrations in order:

```
✅ 20251025000001_add_company_source_fields.sql
✅ 20251025000002_add_contact_tracking_fields.sql
✅ 20251025000003_create_meeting_contacts_junction.sql
✅ 20251025000004_add_meeting_id_to_activities.sql
✅ 20251025000005_create_meeting_insights_tables.sql
✅ 20251025000006_create_insights_aggregation_functions.sql
✅ 20251025000007_create_pipeline_sentiment_recommendations.sql
✅ 20251025200000_fathom_action_items_tasks_sync.sql
✅ 20251025201000_task_notification_system.sql
✅ 20251025202000_backfill_action_items_to_tasks.sql
✅ 20251025203000_action_items_tasks_sync_rls_policies.sql
✅ 20251025210000_add_ai_action_item_analysis.sql
✅ 20251025210000_add_transcript_text_column.sql
✅ 20251025210500_ai_analysis_simpler_approach.sql
```

**How to Run**:

**Option A: Supabase Dashboard (Recommended)**
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/database/migrations
2. Click "Create Migration" → "Import SQL"
3. Upload each `.sql` file from `supabase/migrations/`
4. Review and click "Run Migration"

**Option B: Supabase CLI**
```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase db push
```

**Verification**:
```sql
-- Check meetings table has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('transcript_text', 'source', 'first_seen_at');

-- Check action items sync columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN ('task_id', 'synced_to_task', 'sync_status', 'ai_task_type');
```

---

### Step 2: Edge Functions Environment Variables 🔐

**Location**: Supabase Dashboard → Edge Functions → Settings → Secrets

**Required Secrets**:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `ANTHROPIC_API_KEY` | (from your .env) | AI task analysis (Claude Haiku 4.5) |
| `GOOGLE_CLIENT_ID` | (from your .env) | Google Docs creation |
| `GOOGLE_CLIENT_SECRET` | (from your .env) | Google Docs authentication |
| `SUPABASE_URL` | *(auto-provided)* | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | *(auto-provided)* | Service role access |

**How to Add**:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions
2. Click "Settings" (top right)
3. Under "Secrets", add each secret:
   - Click "New Secret"
   - Enter name and value
   - Click "Save"

**Copy from Local .env**:
```bash
# Look in your .env file for variables starting with VITE_ANTHROPIC_API_KEY, etc.
# Copy the VALUES (not the full line) and add them WITHOUT the VITE_ prefix
# For example:
#   .env has: VITE_ANTHROPIC_API_KEY=sk-ant-...
#   Add to Edge Functions as: ANTHROPIC_API_KEY = sk-ant-...
```

---

### Step 3: Deploy Edge Functions 🚀

**New Functions to Deploy**:

1. **analyze-action-item** - AI-powered task categorization
2. **fathom-backfill-companies** - Backfill company data for existing meetings

**Updated Functions**:
1. **fathom-sync** - Enhanced with company matching and transcript fetching

**Deploy Commands**:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy new functions
supabase functions deploy analyze-action-item
supabase functions deploy fathom-backfill-companies

# Update existing function
supabase functions deploy fathom-sync
```

**Expected Output**:
```
Deploying function analyze-action-item...
✓ Function deployed successfully
Function URL: https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item
```

**Verification**:
```bash
# Test analyze-action-item function
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"action_item_id": "test", "title": "Send pricing proposal to client"}'

# Expected response:
# {
#   "task_type": "proposal",
#   "ideal_deadline": "2025-10-28",
#   "confidence_score": 0.95,
#   "reasoning": "Action item explicitly mentions sending a proposal..."
# }
```

---

### Step 4: Verify Database Schema Changes ✅

**Check meetings table**:
```sql
-- New columns added:
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN (
    'transcript_text',           -- Full transcript plaintext
    'source',                    -- Source tracking
    'first_seen_at'              -- Discovery timestamp
  )
ORDER BY column_name;
```

**Check meeting_action_items table**:
```sql
-- Sync and AI columns:
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN (
    'task_id',                   -- Link to tasks
    'synced_to_task',           -- Sync status boolean
    'sync_status',              -- 'pending', 'synced', 'failed', 'excluded'
    'sync_error',               -- Error message if failed
    'synced_at',                -- Sync timestamp
    'ai_task_type',             -- AI-determined task type
    'ai_deadline',              -- AI-suggested deadline
    'ai_confidence_score',      -- AI confidence (0-1)
    'ai_reasoning',             -- AI explanation
    'ai_analyzed_at'            -- AI analysis timestamp
  )
ORDER BY column_name;
```

**Check companies table**:
```sql
-- Company enrichment columns:
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN (
    'source',                    -- Discovery source
    'first_seen_at'              -- First seen timestamp
  )
ORDER BY column_name;
```

**Check new tables**:
```sql
-- Meeting insights tables:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'meeting_contacts',          -- Junction table
    'meeting_insights',          -- Aggregated insights
    'pipeline_recommendations'   -- AI recommendations
  );
```

---

### Step 5: Test Fathom Sync 🧪

**Manual Sync Test**:

1. **Trigger a manual sync**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

2. **Check Edge Function logs**:
   - Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions/fathom-sync/logs
   - Look for:
     - ✅ Summary fetched from API
     - ✅ Transcript fetched from API
     - ✅ Company matched/created
     - ✅ Task created from action item

3. **Verify data in database**:
```sql
-- Check latest meetings have transcript_text
SELECT
  id,
  title,
  LENGTH(summary) as summary_len,
  LENGTH(transcript_text) as transcript_len,
  created_at
FROM meetings
WHERE last_synced_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check action items synced to tasks
SELECT
  mai.title,
  mai.sync_status,
  mai.ai_task_type,
  mai.ai_confidence_score,
  t.id as task_id,
  t.task_type
FROM meeting_action_items mai
LEFT JOIN tasks t ON t.id = mai.task_id
WHERE mai.created_at > NOW() - INTERVAL '1 hour'
ORDER BY mai.created_at DESC
LIMIT 10;
```

---

### Step 6: Verify AI Task Analysis 🤖

**Test AI Analysis**:

1. **Create a test action item**:
```sql
-- Create test meeting first
INSERT INTO meetings (title, user_id, scheduled_at)
VALUES ('Test Meeting', auth.uid(), NOW())
RETURNING id;

-- Create action item (triggers auto-sync)
INSERT INTO meeting_action_items (
  meeting_id,
  title,
  priority,
  category,
  assignee_email
) VALUES (
  '<meeting_id_from_above>',
  'Send pricing proposal to Acme Corp',
  'high',
  'Sales',
  'your@email.com'
) RETURNING id;
```

2. **Check auto-created task**:
```sql
-- Task should be created automatically
SELECT
  mai.id as action_item_id,
  mai.title,
  mai.sync_status,
  t.id as task_id,
  t.task_type,
  t.due_date
FROM meeting_action_items mai
LEFT JOIN tasks t ON t.id = mai.task_id
WHERE mai.id = '<action_item_id>'
```

3. **Manually trigger AI analysis** (if not automatic):
```sql
-- Call the SQL function directly
SELECT * FROM analyze_action_item_with_ai('<action_item_id>');
```

4. **Verify AI results**:
```sql
SELECT
  title,
  ai_task_type,           -- Should be 'proposal'
  ai_deadline,            -- Should be 2-3 days from now
  ai_confidence_score,    -- Should be > 0.8
  ai_reasoning            -- AI's explanation
FROM meeting_action_items
WHERE id = '<action_item_id>';
```

**Expected Results**:
- `ai_task_type`: "proposal" (for proposal-related items)
- `ai_deadline`: 2-3 days from creation (for high priority proposals)
- `ai_confidence_score`: 0.80 - 0.95 (high confidence)
- `ai_reasoning`: Detailed explanation of categorization

---

### Step 7: Check Notifications 📬

**Verify notification system**:

```sql
-- Check recent task notifications
SELECT
  n.id,
  n.title,
  n.message,
  n.category,
  n.priority,
  n.created_at,
  n.read
FROM notifications n
WHERE n.category = 'task'
  AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC
LIMIT 10;

-- Check notification triggers exist
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%'
ORDER BY trigger_name;
```

**Expected Notification Types**:
1. **New Task from Meeting** - "New task created from Fathom meeting"
2. **Task Deadline Reminder** - "Task due in 1 day"
3. **Overdue Task Alert** - "Task is overdue"
4. **Task Reassignment** - "Task assigned to you"

---

## 🔍 Troubleshooting

### Issue: Migrations Failed

**Check migration status**:
```sql
-- View migration history
SELECT * FROM _migrations ORDER BY created_at DESC LIMIT 20;
```

**Retry failed migration**:
1. Go to Supabase Dashboard → Database → Migrations
2. Find failed migration
3. Click "Retry Migration"

### Issue: Edge Function Deployment Failed

**Check Supabase CLI version**:
```bash
supabase --version
# Should be >= 1.200.0
```

**Re-authenticate**:
```bash
supabase logout
supabase login
```

**Manual deployment via Dashboard**:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions
2. Click "New Function"
3. Copy code from `supabase/functions/[function-name]/index.ts`
4. Paste and deploy

### Issue: AI Analysis Not Running

**Check ANTHROPIC_API_KEY is set**:
```bash
# In Supabase Dashboard → Edge Functions → Settings → Secrets
# Verify ANTHROPIC_API_KEY exists
```

**Check Edge Function logs**:
```
Go to: Functions → analyze-action-item → Logs
Look for errors related to:
- Missing API key
- Rate limits
- Invalid API key format
```

**Manually trigger analysis**:
```sql
-- Process all pending items
SELECT * FROM get_pending_ai_analysis();

-- Analyze specific meeting's action items
SELECT reanalyze_action_items_with_ai('<meeting_id>');
```

### Issue: Tasks Not Auto-Creating

**Check trigger exists**:
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_task_from_action_item';
```

**Manually sync action items**:
```sql
-- Sync single action item
SELECT sync_action_item_to_task('<action_item_id>');

-- Sync all action items for a meeting
SELECT sync_meeting_action_items('<meeting_id>');
```

**Check RLS policies**:
```sql
-- Verify action items RLS
SELECT * FROM pg_policies
WHERE tablename = 'meeting_action_items';

-- Verify tasks RLS
SELECT * FROM pg_policies
WHERE tablename = 'tasks';
```

---

## 📊 Success Metrics

After setup, you should see:

✅ **Database**:
- [ ] 14 new migrations applied successfully
- [ ] `meetings` table has `transcript_text` column
- [ ] `meeting_action_items` has sync and AI columns
- [ ] New tables: `meeting_contacts`, `meeting_insights`, `pipeline_recommendations`

✅ **Edge Functions**:
- [ ] `analyze-action-item` deployed and responding
- [ ] `fathom-backfill-companies` deployed
- [ ] `fathom-sync` updated with new features
- [ ] All environment secrets configured

✅ **Functionality**:
- [ ] Fathom sync creates tasks from action items
- [ ] AI categorizes tasks correctly (>80% confidence)
- [ ] Notifications created for new tasks
- [ ] Companies auto-matched from meeting attendees
- [ ] Transcripts stored and searchable

✅ **Testing**:
- [ ] Manual sync completes without errors
- [ ] Test action item creates task automatically
- [ ] AI analysis returns valid categorization
- [ ] Notifications appear in `notifications` table

---

## 📚 Documentation References

- [Fathom AI Analysis](./FATHOM_AI_ANALYSIS.md) - AI task categorization details
- [Fathom Tasks Sync](./FATHOM_TASKS_SYNC_IMPLEMENTATION.md) - Bidirectional sync details
- [Fathom Meeting Details](./FATHOM_MEETING_DETAILS_IMPLEMENTATION.md) - Transcript fetching details

---

## 🚀 Next Steps

Once setup is complete:

1. **Run Initial Backfill** (optional):
```bash
# Backfill companies for existing meetings
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-backfill-companies' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "YOUR_USER_ID", "limit": 100}'
```

2. **Setup Cron Jobs** (optional - for scheduled notifications):
```sql
-- Daily at 9 AM - upcoming deadline notifications
SELECT cron.schedule(
  'notify-upcoming-task-deadlines',
  '0 9 * * *',
  $$SELECT notify_upcoming_task_deadlines()$$
);

-- Daily at 9 AM and 5 PM - overdue task notifications
SELECT cron.schedule(
  'notify-overdue-tasks',
  '0 9,17 * * *',
  $$SELECT notify_overdue_tasks()$$
);
```

3. **Monitor Performance**:
- Edge Function invocation counts
- AI analysis success rates
- Task creation rates
- Notification delivery

4. **User Testing**:
- Test with real Fathom meetings
- Verify action items sync correctly
- Check AI categorization accuracy
- Validate notification timing

---

## ✅ Setup Complete!

Once all steps are complete, the Fathom integration will:
- ✅ Auto-fetch summaries and transcripts for all meetings
- ✅ Match companies from meeting attendees
- ✅ Create tasks from action items (internal assignees only)
- ✅ Use AI to categorize and set deadlines
- ✅ Send notifications for new tasks, deadlines, and overdue items
- ✅ Enable full-text search on meeting transcripts

**Questions or Issues?**
- Check Edge Function logs in Supabase Dashboard
- Review migration status in Database → Migrations
- See troubleshooting section above

---

**Setup Guide Version**: 1.0
**Last Updated**: October 26, 2025
**Author**: Claude Code
