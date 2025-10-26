# Quick Start - Fathom Integration Setup

**Status**: Manual setup required (Supabase CLI down)
**Time**: ~45 minutes
**Date**: October 26, 2025

---

## 🎯 What You Need to Do

### 1️⃣ Apply Database Migrations (15-20 min)

**URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new

**Steps**:
1. Open SQL Editor in Supabase Dashboard
2. For each migration file (1-15), copy SQL → paste → run
3. Special handling for #16 (storage bucket)

**Migration Files** (in order):
```
supabase/migrations/20251025000001_add_company_source_fields.sql
supabase/migrations/20251025000002_add_contact_tracking_fields.sql
supabase/migrations/20251025000003_create_meeting_contacts_junction.sql
supabase/migrations/20251025000004_add_meeting_id_to_activities.sql
supabase/migrations/20251025000005_create_meeting_insights_tables.sql
supabase/migrations/20251025000006_create_insights_aggregation_functions.sql
supabase/migrations/20251025000007_create_pipeline_sentiment_recommendations.sql
supabase/migrations/20251025200000_fathom_action_items_tasks_sync.sql
supabase/migrations/20251025201000_task_notification_system.sql
supabase/migrations/20251025202000_backfill_action_items_to_tasks.sql
⚠️ USE FIXED: MIGRATION_FIX_rls_policies.sql (NOT original 20251025203000)
supabase/migrations/20251025210000_add_ai_action_item_analysis.sql
supabase/migrations/20251025210000_add_transcript_text_column.sql
supabase/migrations/20251025210500_ai_analysis_simpler_approach.sql
supabase/migrations/20251025_add_fathom_metadata_fields.sql
```

**⚠️ Important Notes**:
- **Migration #11**: Use `MIGRATION_FIX_rls_policies.sql` (fixes `deals.user_id` → `deals.owner_id`)
- **Migration #16**: See storage bucket special handling below

**Migration #16 - Special (Storage Bucket)**:
- **Step A**: Create bucket via Dashboard → Storage → New Bucket
  - Name: `meeting-assets`
  - Public: YES
- **Step B**: Run SQL from `MIGRATION_FIX_storage_bucket.sql`

**Verify**:
```sql
SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version LIKE '20251025%';
-- Should return: 16
```

---

### 2️⃣ Deploy Edge Functions (10-15 min)

**URL**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/functions

**Functions to Deploy**:

#### NEW: `analyze-action-item`
- Click "Create Function"
- Name: `analyze-action-item`
- Copy code from: `supabase/functions/analyze-action-item/index.ts`
- Deploy

#### NEW: `fathom-backfill-companies`
- Click "Create Function"
- Name: `fathom-backfill-companies`
- Copy code from: `supabase/functions/fathom-backfill-companies/index.ts`
- Deploy

#### UPDATE: `fathom-sync`
- Find existing function
- Click "Edit"
- Replace code with: `supabase/functions/fathom-sync/index.ts`
- Deploy

---

### 3️⃣ Verify Setup (5-10 min)

**Check database schema**:
```sql
-- meetings table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meetings' AND column_name = 'transcript_text';

-- meeting_action_items table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meeting_action_items' AND column_name = 'ai_task_type';

-- New tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('meeting_contacts', 'meeting_insights', 'pipeline_recommendations');
-- Should return: 3
```

---

### 4️⃣ Test (10 min)

**Test Fathom Sync**:
```bash
# Get JWT from browser DevTools → Application → Local Storage
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

**Test AI Analysis**:
```sql
-- Create test action item
INSERT INTO meeting_action_items (meeting_id, title, priority, assignee_email)
SELECT id, 'Send pricing proposal to client', 'high', 'test@example.com'
FROM meetings LIMIT 1;

-- Wait 5 seconds, then check:
SELECT ai_task_type, ai_confidence_score
FROM meeting_action_items
WHERE title = 'Send pricing proposal to client';
-- Expected: ai_task_type = 'proposal', confidence > 0.8
```

---

## ✅ Success Checklist

After completing all steps:

- [ ] 16 migrations applied (run count query)
- [ ] 3 edge functions deployed (2 new + 1 updated)
- [ ] `meetings.transcript_text` column exists
- [ ] `meeting_action_items.ai_task_type` column exists
- [ ] Storage bucket `meeting-assets` created
- [ ] AI analysis returns valid task_type
- [ ] Notifications being created

---

## 📚 Full Guides

- **[MANUAL_SETUP_STEPS.md](MANUAL_SETUP_STEPS.md)** - Complete walkthrough with troubleshooting
- **[WHATS_NEW.md](WHATS_NEW.md)** - Feature overview and benefits

---

## 🐛 Common Issues

### "must be owner of table buckets"
- **Fix**: Create storage bucket via Dashboard first (Storage → New Bucket)

### "relation already exists"
- **Fix**: Migration is idempotent, safe to ignore if object exists

### Edge Function 502 error
- **Fix**: Check secrets are configured (Edge Functions → Settings → Secrets)

### AI analysis not running
- **Fix**: Verify `ANTHROPIC_API_KEY` secret is set

---

## 🎉 What You Get

After setup:
- ✅ AI categorizes tasks from meeting action items (~95% accuracy)
- ✅ Auto-creates CRM tasks (internal team only)
- ✅ Smart notifications (new task, deadlines, overdue)
- ✅ Company matching from meeting attendees
- ✅ Full meeting transcripts with search
- ✅ Cost: ~$0.0007 per action item

---

**Need Help?** See [MANUAL_SETUP_STEPS.md](MANUAL_SETUP_STEPS.md) for detailed instructions.

**Ready to start?** Begin with Step 1 (Database Migrations) above! 🚀
