# Manual Setup Steps - Supabase Dashboard

**Created**: October 26, 2025
**Reason**: Supabase CLI experiencing API timeouts
**Status**: Complete these steps via Supabase Dashboard

---

## ⚠️ Current Situation

The Supabase CLI is experiencing 502/504 Gateway timeouts, preventing automated deployment. All setup steps can be completed manually through the Supabase Dashboard.

**Dashboard URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb

---

## ✅ Step 1: Apply Database Migrations

**Location**: Database → SQL Editor

### Migrations to Apply (in order):

1. **20251025000001_add_company_source_fields.sql**
2. **20251025000002_add_contact_tracking_fields.sql**
3. **20251025000003_create_meeting_contacts_junction.sql**
4. **20251025000004_add_meeting_id_to_activities.sql**
5. **20251025000005_create_meeting_insights_tables.sql**
6. **20251025000006_create_insights_aggregation_functions.sql**
7. **20251025000007_create_pipeline_sentiment_recommendations.sql**
8. **20251025200000_fathom_action_items_tasks_sync.sql**
9. **20251025201000_task_notification_system.sql**
10. **20251025202000_backfill_action_items_to_tasks.sql**
11. **20251025203000_action_items_tasks_sync_rls_policies.sql**
12. **20251025210000_add_ai_action_item_analysis.sql**
13. **20251025210000_add_transcript_text_column.sql**
14. **20251025210500_ai_analysis_simpler_approach.sql**
15. **20251025_add_fathom_metadata_fields.sql**
16. ⚠️ **SPECIAL**: **20251025_create_meeting_assets_bucket.sql** - See below

### ⚠️ SPECIAL HANDLING: Storage Bucket Creation

**Migration 16** (`20251025_create_meeting_assets_bucket.sql`) requires special handling:

**Step A: Create Storage Bucket via Dashboard**
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/storage/buckets
2. Click "New Bucket"
3. Bucket name: `meeting-assets`
4. Public: **YES** (check the box)
5. Click "Create Bucket"

**Step B: Apply Modified SQL**
Use the fixed SQL from: `/Users/andrewbryce/Documents/sixty-sales-dashboard/MIGRATION_FIX_storage_bucket.sql`

**Why?**: Storage buckets cannot be created via SQL migrations - they require Dashboard creation first, then policies are applied via SQL.

### How to Apply:

1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
2. For each migration file:
   - Open the file from: `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/migrations/[filename]`
   - Copy the entire SQL content
   - Paste into SQL Editor
   - Click "Run" (bottom right)
   - Wait for "Success" message
   - Proceed to next migration

### ⚠️ Important Notes:

- **Run in order** - migrations have dependencies
- **Check for errors** - if a migration fails, note the error message
- **Don't skip migrations** - each builds on the previous
- **IF_NOT_EXISTS clauses** - migrations are designed to be idempotent (safe to re-run)

### Verification After All Migrations:

```sql
-- Run this in SQL Editor to verify:
SELECT COUNT(*) as migration_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%';
-- Should return: 16
```

---

## ✅ Step 2: Deploy Edge Functions

**Location**: Edge Functions

### Functions to Deploy:

#### 1. **analyze-action-item** (NEW)

**Steps**:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions
2. Click "Create Function"
3. Name: `analyze-action-item`
4. Copy code from: `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/analyze-action-item/index.ts`
5. Paste into code editor
6. Click "Deploy"
7. Verify: Function appears in list

**Test**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action_item_id": "test",
    "title": "Send pricing proposal to client",
    "priority": "high"
  }'
```

Expected response:
```json
{
  "task_type": "proposal",
  "ideal_deadline": "2025-10-28",
  "confidence_score": 0.95,
  "reasoning": "..."
}
```

---

#### 2. **fathom-backfill-companies** (NEW)

**Steps**:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions
2. Click "Create Function"
3. Name: `fathom-backfill-companies`
4. Copy code from: `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/fathom-backfill-companies/index.ts`
5. Paste into code editor
6. Click "Deploy"
7. Verify: Function appears in list

**Note**: This function is for manual backfilling only. No immediate testing required.

---

#### 3. **fathom-sync** (UPDATE EXISTING)

**Steps**:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions
2. Find existing `fathom-sync` function
3. Click on it
4. Click "Edit"
5. **Replace entire code** with content from: `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/fathom-sync/index.ts`
6. Click "Deploy"
7. Verify: Version number increments

**Test**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

---

## ✅ Step 3: Verify Edge Functions Secrets

**Location**: Edge Functions → Settings → Secrets

**URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions

**Required Secrets** (you mentioned these are already added):

- [x] `ANTHROPIC_API_KEY` - (from your .env, without VITE_ prefix)
- [x] `GOOGLE_CLIENT_ID` - (from your .env, without VITE_ prefix)
- [x] `GOOGLE_CLIENT_SECRET` - (from your .env, without VITE_ prefix)
- [ ] `SUPABASE_URL` - Should be auto-provided
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Should be auto-provided

**Verify**:
1. Go to Secrets section
2. Check all 5 secrets exist
3. Values should NOT be empty

---

## ✅ Step 4: Verify Database Schema Changes

**Location**: Database → Tables

### Tables to Check:

#### 1. **meetings** table
**New columns**:
- `transcript_text` (text) - Full transcript plaintext
- `source` (text) - Source tracking
- `first_seen_at` (timestamptz) - Discovery timestamp

**Verify**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('transcript_text', 'source', 'first_seen_at');
```

---

#### 2. **meeting_action_items** table
**New columns**:
- `task_id` (uuid) - Link to tasks table
- `synced_to_task` (boolean) - Sync status
- `sync_status` (text) - 'pending', 'synced', 'failed', 'excluded'
- `sync_error` (text) - Error message if failed
- `synced_at` (timestamptz) - Sync timestamp
- `ai_task_type` (text) - AI-determined task type
- `ai_deadline` (date) - AI-suggested deadline
- `ai_confidence_score` (numeric) - AI confidence (0-1)
- `ai_reasoning` (text) - AI explanation
- `ai_analyzed_at` (timestamptz) - AI analysis timestamp

**Verify**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN (
    'task_id', 'synced_to_task', 'sync_status', 'ai_task_type',
    'ai_deadline', 'ai_confidence_score'
  );
```

---

#### 3. **companies** table
**New columns**:
- `source` (text) - Discovery source
- `first_seen_at` (timestamptz) - First seen timestamp

**Verify**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('source', 'first_seen_at');
```

---

#### 4. **New tables**

**Verify these tables exist**:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'meeting_contacts',
    'meeting_insights',
    'pipeline_recommendations'
  )
ORDER BY table_name;
-- Should return 3 rows
```

---

## ✅ Step 5: Test Fathom Sync

### Option A: Automatic Sync (if you have Fathom integration connected)

1. Go to: https://sales.sixtyseconds.video/settings
2. Click "Fathom Integration"
3. Click "Sync Now" button
4. Wait for sync to complete
5. Check Edge Function logs

### Option B: Manual API Test

```bash
# Get your JWT token from browser:
# 1. Open browser DevTools (F12)
# 2. Go to Application → Local Storage → https://sales.sixtyseconds.video
# 3. Find 'sb-ewtuefzeogytgmsnkpmb-auth-token'
# 4. Copy the access_token value

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN_HERE' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

### Expected Response:
```json
{
  "success": true,
  "meetings_synced": 5,
  "action_items_synced": 12,
  "tasks_created": 8,
  "companies_matched": 3
}
```

### Check Logs:
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions/fathom-sync/logs
2. Look for:
   - ✅ Summary fetched from API
   - ✅ Transcript fetched from API
   - ✅ Company matched/created
   - ✅ Task created from action item
   - ✅ AI analysis queued

---

## ✅ Step 6: Verify AI Task Analysis

### Test AI Analysis

**Option A: Create test action item via SQL**:
```sql
-- 1. Get a meeting ID
SELECT id FROM meetings WHERE user_id = auth.uid() LIMIT 1;

-- 2. Create test action item
INSERT INTO meeting_action_items (
  meeting_id,
  title,
  priority,
  category,
  assignee_email
) VALUES (
  'MEETING_ID_FROM_ABOVE',
  'Send pricing proposal to Acme Corp',
  'high',
  'Sales',
  'your@email.com'
) RETURNING id;

-- 3. Wait 5-10 seconds for AI analysis

-- 4. Check results
SELECT
  title,
  ai_task_type,
  ai_deadline,
  ai_confidence_score,
  ai_reasoning
FROM meeting_action_items
WHERE title = 'Send pricing proposal to Acme Corp';
```

**Expected Results**:
- `ai_task_type`: "proposal"
- `ai_deadline`: 2-3 days from now
- `ai_confidence_score`: > 0.80
- `ai_reasoning`: Detailed explanation

---

**Option B: Manual Edge Function Call**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action_item_id": "YOUR_ACTION_ITEM_ID",
    "title": "Send pricing proposal to Acme Corp",
    "priority": "high",
    "category": "Sales",
    "meeting_title": "Q4 Sales Review"
  }'
```

---

## ✅ Step 7: Check Notifications

### Verify notification system is working:

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
  AND n.user_id = auth.uid()
  AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC
LIMIT 10;
```

**Expected Notification Types**:
- New task created from Fathom meeting
- Task deadline reminder (1 day before)
- Overdue task alert
- Task reassignment

---

## 📊 Success Checklist

After completing all steps, verify:

### Database:
- [ ] 16 new migrations applied (verify count query returns 16)
- [ ] `meetings` table has `transcript_text` column
- [ ] `meeting_action_items` has sync and AI columns
- [ ] New tables exist: `meeting_contacts`, `meeting_insights`, `pipeline_recommendations`

### Edge Functions:
- [ ] `analyze-action-item` deployed and responding
- [ ] `fathom-backfill-companies` deployed
- [ ] `fathom-sync` updated (version number incremented)
- [ ] All 5 secrets configured

### Functionality:
- [ ] Fathom sync creates tasks from action items
- [ ] AI categorizes tasks (>80% confidence)
- [ ] Notifications created for new tasks
- [ ] Companies auto-matched from meeting attendees
- [ ] Transcripts stored and searchable

---

## 🐛 Troubleshooting

### Issue: Migration fails with "already exists" error

**Solution**: Migration is idempotent. Check if the object exists:
```sql
-- For table:
SELECT * FROM information_schema.tables WHERE table_name = 'TABLE_NAME';

-- For column:
SELECT * FROM information_schema.columns WHERE table_name = 'TABLE_NAME' AND column_name = 'COLUMN_NAME';

-- For function:
SELECT * FROM pg_proc WHERE proname = 'FUNCTION_NAME';
```

If exists, skip that specific CREATE statement and run the rest.

---

### Issue: Edge Function deployment fails

**Solution**:
1. Check function logs for errors
2. Verify secrets are set correctly
3. Try deleting and recreating the function
4. Check for syntax errors in code

---

### Issue: AI analysis not running

**Solution**:
```sql
-- Check pending items
SELECT * FROM get_pending_ai_analysis();

-- Manually trigger analysis
SELECT reanalyze_action_items_with_ai('MEETING_ID');

-- Check Edge Function logs
-- Go to: Edge Functions → analyze-action-item → Logs
```

---

### Issue: Tasks not auto-creating

**Solution**:
```sql
-- Check trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_task_from_action_item';

-- Manually sync action items
SELECT sync_action_item_to_task('ACTION_ITEM_ID');

-- Sync all action items for a meeting
SELECT sync_meeting_action_items('MEETING_ID');
```

---

## 📝 Notes

- **Migration order matters** - apply in sequence
- **Edge Functions need secrets** - verify before deploying
- **Test incrementally** - verify each step before proceeding
- **Check logs frequently** - they provide detailed error messages
- **Supabase CLI issues** - temporary API timeouts, Dashboard is reliable

---

## 🎯 After Setup

Once all steps are complete:

1. **Test with real Fathom meeting** - sync a recent meeting
2. **Verify AI accuracy** - check task categorization
3. **Monitor notifications** - ensure they're being created
4. **Check company matching** - verify attendees linked correctly
5. **Search transcripts** - test full-text search functionality

---

**Setup Guide Version**: Manual v1.0
**Last Updated**: October 26, 2025
**Author**: Claude Code
**Reason**: Supabase CLI API timeouts
