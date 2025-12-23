# Running Comprehensive Tests

## Test 1: Integration Test Suite

Run the SQL integration tests in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql/new
2. Copy and paste the entire contents of: `supabase/tests/fathom_integration_test.sql`
3. Click "Run"
4. Review the output - all tests should show ✅ PASSED

**What it tests**:
- ✅ Company creation with source tracking
- ✅ Contact management with email normalization
- ✅ Meeting creation with transcripts
- ✅ Action items → Tasks sync (internal assignees)
- ✅ External assignee exclusion
- ✅ AI analysis system components
- ✅ Meeting insights (company & contact)
- ✅ Storage bucket existence

## Test 2: Fathom Bulk Sync Test

Run the bulk sync test to simulate 10 Fathom webhook calls:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Make sure SUPABASE_SERVICE_ROLE_KEY is set
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Run the bulk test
deno run --allow-net --allow-env test-fathom-sync-bulk.ts
```

**What it tests**:
- ✅ 10 different meeting scenarios
- ✅ Multiple companies and contacts
- ✅ Various action item priorities
- ✅ Internal vs external assignees
- ✅ Performance timing
- ✅ Error handling

**Expected output**:
```
==========================================
🧪 Testing Fathom Sync with 10 Mock Calls
==========================================

📞 Test 1/10: Discovery Call - TechCorp
   ✅ Success (XXXms)
📞 Test 2/10: Demo - StartupXYZ
   ✅ Success (XXXms)
...

==========================================
📊 BULK TEST RESULTS
==========================================
Total Tests: 10
✅ Successful: 10
❌ Errors: 0
⏱️  Average Time: XXXms
⏱️  Total Time: XXXXms
==========================================
```

## Test 3: Verify Database State

After running the bulk sync test, check the database:

```sql
-- Check created meetings
SELECT
  COUNT(*) as total_meetings,
  COUNT(DISTINCT company_id) as unique_companies,
  COUNT(DISTINCT fathom_recording_id) as fathom_meetings
FROM meetings
WHERE fathom_recording_id LIKE 'fathom_test_%';

-- Check action items created
SELECT
  COUNT(*) as total_action_items,
  COUNT(task_id) as synced_to_tasks,
  COUNT(*) FILTER (WHERE sync_status = 'synced') as synced_count,
  COUNT(*) FILTER (WHERE sync_status = 'excluded') as excluded_count
FROM meeting_action_items
WHERE meeting_id IN (
  SELECT id FROM meetings WHERE fathom_recording_id LIKE 'fathom_test_%'
);

-- Check companies created
SELECT name, domain, source, first_seen_at
FROM companies
WHERE name IN (
  'TechCorp', 'StartupXYZ', 'MegaCorp', 'FastGrow Inc',
  'DataDriven LLC', 'GreenTech Solutions', 'BankCorp',
  'InnovateLabs', 'LegacyCorp', 'GlobalEnterprises'
)
ORDER BY first_seen_at DESC;

-- Check tasks created
SELECT
  t.title,
  t.priority,
  t.task_type,
  t.assigned_to,
  mai.title as action_item_title
FROM tasks t
JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE mai.meeting_id IN (
  SELECT id FROM meetings WHERE fathom_recording_id LIKE 'fathom_test_%'
);
```

**Expected Results**:
- 10 meetings created
- 10 unique companies
- 15-17 action items total (some meetings have multiple)
- ~10-12 tasks created (internal assignees only)
- ~5 action items excluded (external assignees)

## Test 4: AI Analysis

Trigger AI analysis on a few action items:

```bash
# Get pending items
SELECT * FROM get_pending_ai_analysis() LIMIT 3;

# Trigger analysis on one
./TRIGGER_AI_ANALYSIS.sh

# Or manually:
curl -X POST "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action_item_id": "YOUR_ACTION_ITEM_ID"}' \
  | jq '.'
```

## Test 5: Cleanup (Optional)

To remove all test data:

```sql
-- Remove test meetings and related data
DELETE FROM meeting_action_items
WHERE meeting_id IN (
  SELECT id FROM meetings WHERE fathom_recording_id LIKE 'fathom_test_%'
);

DELETE FROM meeting_contacts
WHERE meeting_id IN (
  SELECT id FROM meetings WHERE fathom_recording_id LIKE 'fathom_test_%'
);

DELETE FROM meetings
WHERE fathom_recording_id LIKE 'fathom_test_%';

-- Remove test companies and contacts
DELETE FROM contacts
WHERE email IN (
  SELECT DISTINCT jsonb_array_elements(participants)->>'email'
  FROM meetings
  WHERE fathom_recording_id LIKE 'fathom_test_%'
);

-- Verify cleanup
SELECT COUNT(*) FROM meetings WHERE fathom_recording_id LIKE 'fathom_test_%';
SELECT COUNT(*) FROM meeting_action_items WHERE title LIKE 'TEST:%';
```

## Success Criteria

All tests should pass with:
- ✅ 0 SQL errors
- ✅ All database functions working
- ✅ All triggers firing correctly
- ✅ Proper sync status tracking
- ✅ AI analysis components present
- ✅ Edge functions responding
- ✅ Data integrity maintained
