# Testing Guide - Fathom Integration

Complete testing checklist for the newly deployed Fathom integration features.

## 🎯 Testing Overview

**Features to Test**:
1. **NEW: Transcript AI Analysis** (Claude Haiku 4.5 analysis during sync)
2. AI Task Categorization (analyze-action-item function)
3. Bidirectional Task Sync (Fathom ↔ CRM)
4. Company Enrichment (company matching from attendees)
5. Meeting Transcripts (full-text storage and search)
6. Task Notifications (automated follow-ups)
7. Video Thumbnails (AWS S3 storage)

---

## ✅ Pre-Testing Checklist

- [x] All migrations applied (including 20251026_add_ai_analysis_columns.sql)
- [x] Storage bucket created (meeting-assets)
- [x] Edge functions deployed (fathom-sync v32)
- [x] Secrets configured:
  - [ ] **ANTHROPIC_API_KEY** (Required for new transcript AI analysis)
  - [ ] **CLAUDE_MODEL** (Optional: claude-haiku-4.5)
  - [x] AWS credentials
  - [x] Fathom OAuth tokens

---

## 🧪 Test 0: Transcript AI Analysis (NEW v32)

**Purpose**: Verify automatic transcript fetching and Claude Haiku 4.5 AI analysis during sync

**⚠️ CRITICAL**: Must set `ANTHROPIC_API_KEY` in Supabase Edge Function secrets first!

**Model**: Claude Haiku 4.5 (claude-haiku-4.5)

### Configuration Steps:

1. **Set API Key**:
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
   - Click "Secrets" tab
   - Add `ANTHROPIC_API_KEY` with your Anthropic API key
   - Optionally add `CLAUDE_MODEL` = `claude-haiku-4.5` (this is the default)
   - Redeploy function: `npx supabase functions deploy fathom-sync`

### Test Steps:

1. **Trigger manual sync** (last 7 days, 5 meetings for testing):
```bash
# Get auth token from browser console:
# localStorage.getItem('supabase.auth.token')

curl -X POST "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_type": "manual",
    "start_date": "2025-10-19T00:00:00Z",
    "end_date": "2025-10-26T23:59:59Z",
    "limit": 5
  }'
```

2. **Monitor Edge Function logs**:
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions?type=fathom-sync

   **Success Indicators**:
   ```
   ✅ "📄 Auto-fetching transcript for [id] (attempt 1/3)..."
   ✅ "✅ Transcript fetched: 15234 characters"
   ✅ "🤖 Running Claude AI analysis on transcript..."
   ✅ "✅ AI metrics stored: sentiment=0.75, rep=45%, customer=55%"
   ✅ "💾 Storing 3 AI-generated action items..."
   ✅ "🔄 Skipping duplicate AI action item: ..."
   ```

   **Normal Warnings** (expected for recent meetings):
   ```
   ℹ️ "Transcript not yet available - will retry next sync"
   ℹ️ "Summary fetch failed (non-fatal)"
   ```

   **Error Indicators** (investigate if seen):
   ```
   ❌ "ANTHROPIC_API_KEY not configured"
   ❌ "Claude API error: 401"
   ❌ "Error in auto-fetch and analyze"
   ```

3. **Verify database results**:

   **a) Check new columns exist**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'meetings'
     AND column_name IN (
       'transcript_fetch_attempts',
       'last_transcript_fetch_at',
       'talk_time_rep_pct',
       'talk_time_customer_pct',
       'sentiment_score',
       'sentiment_reasoning',
       'talk_time_judgement'
     );
   ```
   **Expected**: 7 rows

   **b) Check meetings with AI analysis**:
   ```sql
   SELECT
     title,
     meeting_start,
     LENGTH(transcript_text) as transcript_length,
     sentiment_score,
     talk_time_rep_pct,
     talk_time_customer_pct,
     talk_time_judgement
   FROM meetings
   WHERE meeting_start >= NOW() - INTERVAL '7 days'
     AND transcript_text IS NOT NULL
   ORDER BY meeting_start DESC
   LIMIT 5;
   ```
   **Expected**: Meetings with populated AI metrics

   **c) Check AI-generated action items**:
   ```sql
   SELECT
     m.title as meeting_title,
     mai.title as action_item,
     mai.category,
     mai.priority,
     mai.ai_confidence,
     mai.needs_review,
     mai.assigned_to_name,
     mai.deadline_date
   FROM meeting_action_items mai
   JOIN meetings m ON mai.meeting_id = m.id
   WHERE mai.ai_generated = true
     AND m.meeting_start >= NOW() - INTERVAL '7 days'
   ORDER BY m.meeting_start DESC, mai.ai_confidence DESC
   LIMIT 10;
   ```
   **Expected**: Action items with confidence scores 0.5-1.0

   **d) Check retry tracking**:
   ```sql
   SELECT
     COUNT(CASE WHEN transcript_text IS NOT NULL THEN 1 END) as with_transcript,
     COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts = 0 THEN 1 END) as not_attempted,
    COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 1 AND 2 THEN 1 END) as retrying_5_min,
    COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 3 AND 5 THEN 1 END) as retrying_15_min,
    COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 6 AND 11 THEN 1 END) as retrying_60_min,
    COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts >= 12 THEN 1 END) as heavy_retry_180_plus
   FROM meetings
   WHERE meeting_start >= NOW() - INTERVAL '7 days';
   ```
   **Expected**: Appropriate distribution based on meeting age

4. **Verify frontend display**:
   - Navigate to meeting detail page
   - **Check for**:
     - ✅ Summary displayed (no fetch button)
     - ✅ Transcript link (if processed)
     - ✅ Action items (AI + Fathom mixed)
     - ✅ Sentiment badge (Positive/Neutral/Challenging)
     - ✅ Talk time percentages in sidebar
     - ✅ "Processing" message if < 15 min old

**Success Criteria**:
- ✅ Transcripts fetching automatically (no buttons needed)
- ✅ AI metrics populated (sentiment, talk time)
- ✅ AI action items extracted with confidence scores
- ✅ Deduplication working (no identical Fathom + AI items)
- ✅ Retry logic functioning (attempts tracked)
- ✅ No critical errors in logs

**Cost Monitoring**:
```sql
SELECT
  COUNT(*) as total_analyses,
  COUNT(*) * 0.01 as estimated_cost_usd
FROM meetings
WHERE sentiment_score IS NOT NULL
  AND meeting_start >= NOW() - INTERVAL '30 days';
```
**Expected cost**: ~$0.01 per meeting

**For comprehensive SQL queries**, see: `VERIFY_TRANSCRIPT_AI_ANALYSIS.sql`

**For detailed troubleshooting**, see: `AI_ANALYSIS_IMPLEMENTATION.md`

---

## 🧪 Test 1: AI Task Categorization

**Purpose**: Verify Claude Haiku 4.5 correctly categorizes action items

### Test Steps:

1. **Create test action item** via SQL:
```sql
INSERT INTO meeting_action_items (
  meeting_id,
  title,
  assignee_email,
  priority,
  deadline_at
)
SELECT
  id,
  'Send pricing proposal to Acme Corp',
  'test@example.com',
  'high',
  NOW() + INTERVAL '3 days'
FROM meetings
LIMIT 1;
```

2. **Wait 3-5 seconds** for trigger to fire

3. **Check AI analysis results**:
```sql
SELECT
  title,
  ai_task_type,
  ai_confidence_score,
  ai_reasoning
FROM meeting_action_items
WHERE title = 'Send pricing proposal to Acme Corp';
```

**Expected Results**:
- `ai_task_type` = `'proposal'`
- `ai_confidence_score` > 0.8
- `ai_reasoning` contains explanation

**Cost**: ~$0.0007 per action item

---

## 🧪 Test 2: Task Sync (Fathom → CRM)

**Purpose**: Verify action items assigned to internal users create CRM tasks

### Test Steps:

1. **Get your email**:
```sql
SELECT email FROM auth.users LIMIT 1;
```

2. **Create action item with your email**:
```sql
INSERT INTO meeting_action_items (
  meeting_id,
  title,
  assignee_email,
  priority,
  deadline_at
)
SELECT
  id,
  'Follow up with John about contract',
  'YOUR_EMAIL_HERE', -- Use your actual email
  'medium',
  NOW() + INTERVAL '2 days'
FROM meetings
LIMIT 1;
```

3. **Check if task was created**:
```sql
SELECT
  t.id,
  t.title,
  t.task_type,
  t.meeting_action_item_id,
  mai.title as action_item_title,
  mai.sync_status
FROM tasks t
JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE mai.title = 'Follow up with John about contract';
```

**Expected Results**:
- Task created with matching title
- `sync_status` = `'synced'`
- `task_type` = `'followup'`
- Task assigned to you

---

## 🧪 Test 3: Task Sync (External Assignee)

**Purpose**: Verify external assignees are excluded from sync

### Test Steps:

1. **Create action item with external email**:
```sql
INSERT INTO meeting_action_items (
  meeting_id,
  title,
  assignee_email,
  priority,
  deadline_at
)
SELECT
  id,
  'Client to review contract',
  'client@external-company.com',
  'high',
  NOW() + INTERVAL '5 days'
FROM meetings
LIMIT 1;
```

2. **Check sync status**:
```sql
SELECT
  title,
  assignee_email,
  sync_status,
  sync_error,
  task_id
FROM meeting_action_items
WHERE title = 'Client to review contract';
```

**Expected Results**:
- `sync_status` = `'excluded'`
- `sync_error` contains "External assignee"
- `task_id` IS NULL (no task created)

---

## 🧪 Test 4: Bidirectional Sync (CRM → Fathom)

**Purpose**: Verify task changes sync back to action items

### Test Steps:

1. **Find a synced task**:
```sql
SELECT
  t.id as task_id,
  mai.id as action_item_id,
  t.title,
  t.status,
  mai.completed
FROM tasks t
JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE t.meeting_action_item_id IS NOT NULL
LIMIT 1;
```

2. **Mark task as completed**:
```sql
UPDATE tasks
SET status = 'completed'
WHERE id = 'TASK_ID_FROM_ABOVE';
```

3. **Verify action item updated**:
```sql
SELECT
  id,
  title,
  completed,
  updated_at
FROM meeting_action_items
WHERE id = 'ACTION_ITEM_ID_FROM_ABOVE';
```

**Expected Results**:
- `completed` = `true`
- `updated_at` reflects recent change

---

## 🧪 Test 5: Fathom Sync (Manual Trigger)

**Purpose**: Test full Fathom sync end-to-end

### Test Steps:

1. **Get JWT token** from browser:
   - Open DevTools (F12)
   - Application → Local Storage
   - Find `sb-ewtuefzeogytgmsnkpmb-auth-token`
   - Copy the `access_token` value

2. **Trigger manual sync**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"sync_type": "manual"}'
```

3. **Check sync results**:
```sql
-- Check new meetings
SELECT
  id,
  title,
  source,
  first_seen_at,
  created_at
FROM meetings
WHERE source = 'fathom'
ORDER BY created_at DESC
LIMIT 5;

-- Check new action items
SELECT
  mai.id,
  mai.title,
  mai.sync_status,
  mai.ai_task_type,
  m.title as meeting_title
FROM meeting_action_items mai
JOIN meetings m ON m.id = mai.meeting_id
WHERE m.source = 'fathom'
ORDER BY mai.created_at DESC
LIMIT 10;
```

**Expected Results**:
- New meetings with `source = 'fathom'`
- Action items with AI categorization
- Internal assignees synced to tasks

---

## 🧪 Test 6: Company Enrichment

**Purpose**: Verify companies are matched/created from meeting attendees

### Test Steps:

1. **Run backfill function**:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-backfill-companies' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

2. **Check results**:
```sql
-- Check companies created from Fathom
SELECT
  id,
  name,
  source,
  first_seen_at
FROM companies
WHERE source = 'fathom_attendee'
ORDER BY first_seen_at DESC;

-- Check meetings linked to companies
SELECT
  m.id,
  m.title,
  c.name as company_name,
  m.company_id
FROM meetings m
JOIN companies c ON c.id = m.company_id
WHERE m.source = 'fathom'
  AND m.company_id IS NOT NULL
ORDER BY m.created_at DESC;
```

**Expected Results**:
- Companies created with `source = 'fathom_attendee'`
- Meetings linked to matched companies

---

## 🧪 Test 7: Meeting Transcripts

**Purpose**: Verify transcript storage and search

### Test Steps:

1. **Check transcript storage**:
```sql
SELECT
  id,
  title,
  LENGTH(transcript_text) as transcript_length,
  source
FROM meetings
WHERE transcript_text IS NOT NULL
  AND source = 'fathom'
ORDER BY created_at DESC
LIMIT 5;
```

2. **Test full-text search**:
```sql
SELECT
  id,
  title,
  ts_rank(
    to_tsvector('english', transcript_text),
    to_tsquery('english', 'pricing & proposal')
  ) as rank
FROM meetings
WHERE to_tsvector('english', transcript_text) @@ to_tsquery('english', 'pricing & proposal')
ORDER BY rank DESC
LIMIT 10;
```

**Expected Results**:
- Transcripts stored in `transcript_text` column
- Search returns ranked results

---

## 🧪 Test 8: Task Notifications

**Purpose**: Verify notification system creates alerts

### Test Steps:

1. **Check notification table**:
```sql
SELECT
  id,
  user_id,
  notification_type,
  title,
  message,
  read,
  created_at
FROM task_notifications
ORDER BY created_at DESC
LIMIT 10;
```

2. **Trigger new notification** (by creating task):
```sql
INSERT INTO tasks (
  title,
  user_id,
  assigned_to,
  priority,
  due_date,
  status
)
SELECT
  'Test notification task',
  id,
  id,
  'high',
  NOW() + INTERVAL '1 day',
  'open'
FROM auth.users
LIMIT 1;
```

3. **Verify notification created**:
```sql
SELECT
  notification_type,
  title,
  message
FROM task_notifications
WHERE title LIKE '%Test notification%'
ORDER BY created_at DESC;
```

**Expected Results**:
- Notification created with type `'new_task'`
- Message contains task details

---

## 🧪 Test 9: Video Thumbnails

**Purpose**: Verify AWS S3 thumbnail generation

### Test Steps:

1. **Check meeting with video URL**:
```sql
SELECT
  id,
  title,
  video_url,
  thumbnail_url
FROM meetings
WHERE video_url IS NOT NULL
  AND source = 'fathom'
ORDER BY created_at DESC
LIMIT 5;
```

2. **Check S3 storage**:
```sql
SELECT
  name,
  bucket_id,
  created_at
FROM storage.objects
WHERE bucket_id = 'meeting-assets'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results**:
- `thumbnail_url` populated for meetings with videos
- Files in `meeting-assets` bucket
- Thumbnails accessible via public URL

---

## 📊 Success Criteria

**All tests should show**:
- ✅ AI analysis running with >80% confidence
- ✅ Internal tasks synced, external excluded
- ✅ Bidirectional sync working both ways
- ✅ Companies matched from attendees
- ✅ Transcripts stored and searchable
- ✅ Notifications created automatically
- ✅ Thumbnails generated and stored

---

## 🐛 Troubleshooting

### AI Analysis Not Running
- Check `ANTHROPIC_API_KEY` secret is set
- Check edge function logs for errors
- Verify action item has `assignee_email`

### Tasks Not Syncing
- Verify email belongs to internal user (in `auth.users`)
- Check `sync_status` and `sync_error` columns
- Ensure triggers are enabled

### Company Matching Fails
- Check attendee email domains
- Verify existing companies in database
- Review fuzzy matching logic

### Thumbnails Not Generated
- Verify AWS credentials configured
- Check `ENABLE_VIDEO_THUMBNAILS` = `true`
- Review edge function logs

---

## 📝 Test Results Template

After running tests, document results:

```
Test 1 (AI Categorization): ✅ / ❌
- Task type: _______
- Confidence: _______
- Notes: _______

Test 2 (Internal Sync): ✅ / ❌
- Task created: Yes/No
- Sync status: _______
- Notes: _______

Test 3 (External Exclusion): ✅ / ❌
- Correctly excluded: Yes/No
- Error message: _______
- Notes: _______

Test 4 (Bidirectional): ✅ / ❌
- Changes synced: Yes/No
- Notes: _______

Test 5 (Fathom Sync): ✅ / ❌
- Meetings synced: _______
- Action items: _______
- Notes: _______

Test 6 (Company Enrichment): ✅ / ❌
- Companies matched: _______
- Notes: _______

Test 7 (Transcripts): ✅ / ❌
- Transcripts stored: Yes/No
- Search working: Yes/No
- Notes: _______

Test 8 (Notifications): ✅ / ❌
- Notifications created: _______
- Notes: _______

Test 9 (Thumbnails): ✅ / ❌
- Thumbnails generated: _______
- S3 storage: Yes/No
- Notes: _______
```

---

**Ready to test!** Start with Test 1 (AI Categorization) and work through each test systematically.
