# Pre-Testing Checklist - Fathom Integration

**Date**: October 26, 2025
**Status**: Setup Required Before Testing

---

## 🎯 Quick Summary

**What Changed**: Pulled 8 commits containing 4 major Fathom feature PRs
**Database Changes**: 14 new migrations
**New Edge Functions**: 2 (analyze-action-item, fathom-backfill-companies)
**Updated Edge Functions**: 1 (fathom-sync)
**New Environment Variables**: 1 (ANTHROPIC_API_KEY for Edge Functions)

---

## ✅ Pre-Testing Checklist

### 1. Database Migrations

**Status**: ⬜ Not Started / ⏳ In Progress / ✅ Complete

**Action**: Run 14 migrations in Supabase Dashboard

```bash
# Via Supabase CLI:
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
supabase db push
```

**Or via Dashboard**:
https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/database/migrations

**Migrations to run** (in order):
- [ ] 20251025000001_add_company_source_fields.sql
- [ ] 20251025000002_add_contact_tracking_fields.sql
- [ ] 20251025000003_create_meeting_contacts_junction.sql
- [ ] 20251025000004_add_meeting_id_to_activities.sql
- [ ] 20251025000005_create_meeting_insights_tables.sql
- [ ] 20251025000006_create_insights_aggregation_functions.sql
- [ ] 20251025000007_create_pipeline_sentiment_recommendations.sql
- [ ] 20251025200000_fathom_action_items_tasks_sync.sql
- [ ] 20251025201000_task_notification_system.sql
- [ ] 20251025202000_backfill_action_items_to_tasks.sql
- [ ] 20251025203000_action_items_tasks_sync_rls_policies.sql
- [ ] 20251025210000_add_ai_action_item_analysis.sql
- [ ] 20251025210000_add_transcript_text_column.sql
- [ ] 20251025210500_ai_analysis_simpler_approach.sql

**Verification**:
```sql
-- Check meetings table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meetings' AND column_name = 'transcript_text';

-- Check action items table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meeting_action_items' AND column_name = 'ai_task_type';
```

---

### 2. Edge Functions Secrets

**Status**: ⬜ Not Started / ⏳ In Progress / ✅ Complete

**Location**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions (Settings → Secrets)

**Required Secrets** (add without VITE_ prefix):

- [ ] `ANTHROPIC_API_KEY` = (copy from .env - remove VITE_ prefix)
- [ ] `GOOGLE_CLIENT_ID` = (copy from .env - remove VITE_ prefix)
- [ ] `GOOGLE_CLIENT_SECRET` = (copy from .env - remove VITE_ prefix)
- [ ] `SUPABASE_URL` = *(auto-provided)*
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = *(auto-provided)*

**How to get values**:
```bash
# Look in your .env file for lines starting with VITE_ANTHROPIC_API_KEY, etc.
# Copy the values WITHOUT the VITE_ prefix to Edge Functions secrets
```

---

### 3. Deploy Edge Functions

**Status**: ⬜ Not Started / ⏳ In Progress / ✅ Complete

**Action**: Deploy via Supabase CLI

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy new functions
supabase functions deploy analyze-action-item
supabase functions deploy fathom-backfill-companies

# Update existing function
supabase functions deploy fathom-sync
```

**Deployed Functions**:
- [ ] analyze-action-item (NEW)
- [ ] fathom-backfill-companies (NEW)
- [ ] fathom-sync (UPDATED)

**Verification**:
```bash
# Test analyze-action-item
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"action_item_id":"test","title":"Send proposal"}'
```

---

### 4. Verify Schema Changes

**Status**: ⬜ Not Started / ⏳ In Progress / ✅ Complete

**Quick Verification Queries**:

```sql
-- 1. Meetings table
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'meetings' AND column_name = 'transcript_text'
) as meetings_ok;

-- 2. Action items table
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'meeting_action_items' AND column_name = 'ai_task_type'
) as action_items_ok;

-- 3. Companies table
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'companies' AND column_name = 'source'
) as companies_ok;

-- 4. New tables
SELECT COUNT(*) as new_tables_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('meeting_contacts', 'meeting_insights', 'pipeline_recommendations');
-- Should return: 3
```

**Expected Results**:
- [ ] meetings_ok = true
- [ ] action_items_ok = true
- [ ] companies_ok = true
- [ ] new_tables_count = 3

---

### 5. Test Basic Functionality

**Status**: ⬜ Not Started / ⏳ In Progress / ✅ Complete

**Test 1: Fathom Sync**
```bash
# Trigger manual sync
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

**Test 2: AI Task Analysis**
```sql
-- Create test action item
INSERT INTO meeting_action_items (meeting_id, title, priority, assignee_email)
SELECT id, 'Send pricing proposal to client', 'high', 'test@example.com'
FROM meetings LIMIT 1
RETURNING id;

-- Wait 5 seconds, then check:
SELECT ai_task_type, ai_confidence_score FROM meeting_action_items
WHERE title = 'Send pricing proposal to client';
-- Expected: ai_task_type = 'proposal', confidence > 0.8
```

**Test 3: Task Auto-Creation**
```sql
-- Check tasks created from action items
SELECT COUNT(*) as tasks_from_meetings
FROM tasks
WHERE meeting_action_item_id IS NOT NULL;
-- Should be > 0 if you have action items
```

**Test 4: Notifications**
```sql
-- Check notifications created
SELECT COUNT(*) as task_notifications
FROM notifications
WHERE category = 'task' AND created_at > NOW() - INTERVAL '1 hour';
```

**Test Results**:
- [ ] Fathom sync completed without errors
- [ ] AI analysis returned valid task_type
- [ ] Tasks auto-created from action items
- [ ] Notifications generated for new tasks

---

## 🎯 What Each Feature Does

### Feature 1: Company Enrichment (PR #36)
- Extracts companies from meeting attendee emails
- Matches to existing CRM companies via domain/name
- Auto-creates new companies if not found
- Links meetings to companies and contacts

**New Tables**: `meeting_contacts` (junction), `meeting_insights`, `pipeline_recommendations`

### Feature 2: Meeting Details (PR #37)
- Always fetches summaries from Fathom API
- Always fetches transcripts and stores in DB
- Creates Google Docs with formatted transcripts
- Enables full-text search on transcript content

**New Columns**: `meetings.transcript_text`

### Feature 3: Action Items → Tasks Sync (PR #35)
- Auto-creates CRM tasks from Fathom action items
- Only syncs internal assignees (your team)
- Bidirectional sync (task complete ↔ action item complete)
- Notifications: new task, deadline reminders, overdue alerts

**New Columns**: `meeting_action_items.task_id`, `sync_status`, `synced_at`, etc.

### Feature 4: AI Task Analysis (PR #38)
- Uses Claude Haiku 4.5 for categorization
- Determines task type: call, email, meeting, proposal, demo, follow_up, general
- Suggests ideal deadline based on priority and type
- Provides confidence score and reasoning

**New Columns**: `meeting_action_items.ai_task_type`, `ai_deadline`, `ai_confidence_score`, `ai_reasoning`

---

## 📋 Testing Priorities

### Must Test (Critical Path):
1. [ ] Database migrations applied successfully
2. [ ] Edge functions deployed and responding
3. [ ] AI analysis returns valid results
4. [ ] Tasks auto-create from action items
5. [ ] Notifications work correctly

### Should Test (Important):
6. [ ] Company matching from meeting attendees
7. [ ] Transcript fetching and storage
8. [ ] Bidirectional sync (task ↔ action item)
9. [ ] Full-text search on transcripts
10. [ ] Deadline reminders and overdue alerts

### Nice to Test (Additional):
11. [ ] AI confidence scoring accuracy
12. [ ] Manual sync controls
13. [ ] Failed sync retry logic
14. [ ] Backfill existing meetings
15. [ ] Pipeline recommendations

---

## 🚨 Common Issues

### Issue: Migrations fail
**Solution**: Check migration order, run one at a time

### Issue: Edge functions not deploying
**Solution**: Check Supabase CLI version (`supabase --version`)

### Issue: AI analysis not running
**Solution**: Verify `ANTHROPIC_API_KEY` is set in Edge Functions secrets

### Issue: Tasks not auto-creating
**Solution**: Check trigger exists: `trigger_auto_create_task_from_action_item`

### Issue: No notifications
**Solution**: Check notification triggers and `notifications` table RLS policies

---

## 📊 Success Criteria

### ✅ Setup Complete When:
- [ ] All 14 migrations applied without errors
- [ ] All 3 edge functions deployed successfully
- [ ] ANTHROPIC_API_KEY configured in Edge Functions
- [ ] Schema verification queries pass
- [ ] Basic functionality tests pass

### ✅ Ready for Full Testing When:
- [ ] Manual Fathom sync completes successfully
- [ ] AI analysis categorizes test action item correctly
- [ ] Task auto-created from action item
- [ ] Notification created for new task
- [ ] Transcript stored in database

---

## 📚 Documentation

Full guides available:
- **Setup Guide**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **AI Analysis**: [FATHOM_AI_ANALYSIS.md](./FATHOM_AI_ANALYSIS.md)
- **Tasks Sync**: [FATHOM_TASKS_SYNC_IMPLEMENTATION.md](./FATHOM_TASKS_SYNC_IMPLEMENTATION.md)
- **Meeting Details**: [FATHOM_MEETING_DETAILS_IMPLEMENTATION.md](./FATHOM_MEETING_DETAILS_IMPLEMENTATION.md)

---

## 🎯 Next Steps

After completing this checklist:

1. **Run full Fathom sync test** with real meeting data
2. **Verify AI categorization accuracy** on various action item types
3. **Test notification delivery** for all scenarios
4. **Monitor Edge Function logs** for errors
5. **Validate company matching** logic with test attendees

---

**Checklist Version**: 1.0
**Last Updated**: October 26, 2025
**Author**: Claude Code

---

## 📝 Notes

- All migrations are timestamped 20251025*
- Edge functions require secrets to be set BEFORE deployment
- AI analysis costs ~$0.0007 per action item (very cheap!)
- Notifications are real-time via PostgreSQL triggers
- Full-text search enabled on transcript_text column

**Time Estimate**: 30-45 minutes for complete setup
