# Final Testing Instructions

## ✅ All Fixes Applied

The integration test suite has been fixed to include required `owner_id` and `user_id` fields.

## 🧪 Run the Complete Test Suite

### Step 1: Run Integration Tests

1. Go to Supabase Dashboard SQL Editor:
   https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql/new

2. Copy the entire contents of this file:
   `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/tests/fathom_integration_test.sql`

3. Paste into the SQL editor

4. Click "Run"

5. **Expected Output**: All 8 test suites should show ✅ PASSED

### Step 2: Verify Database State

After tests complete, run these verification queries:

```sql
-- Check companies created
SELECT COUNT(*) as test_companies
FROM companies
WHERE name LIKE 'TEST:%';

-- Check contacts created
SELECT COUNT(*) as test_contacts
FROM contacts
WHERE name LIKE 'TEST:%';

-- Check meetings created
SELECT COUNT(*) as test_meetings
FROM meetings
WHERE title LIKE 'TEST:%';

-- Check action items synced
SELECT
  COUNT(*) as total_action_items,
  COUNT(task_id) FILTER (WHERE task_id IS NOT NULL) as synced_to_tasks,
  COUNT(*) FILTER (WHERE sync_status = 'synced') as synced_count,
  COUNT(*) FILTER (WHERE sync_status = 'excluded') as excluded_count
FROM meeting_action_items
WHERE title LIKE 'TEST:%';
```

**Expected Results**:
- 1 test company
- 1 test contact
- 1 test meeting
- 2 test action items (1 internal → synced, 1 external → excluded)

### Step 3: Clean Up Test Data (Optional)

After verifying tests pass, you can clean up:

```sql
SELECT test_reset_data();
```

## 📊 What Each Test Suite Validates

1. **Suite 1: Company Matching** ✅
   - Company creation with source tracking
   - Owner ID assignment
   - First seen timestamp

2. **Suite 2: Contact Management** ✅
   - Contact creation with company link
   - Email normalization
   - User ID assignment
   - Source tracking

3. **Suite 3: Meeting with Transcript** ✅
   - Meeting creation
   - Transcript storage
   - Fathom metadata (recording_id, video_url)
   - Company and owner associations

4. **Suite 4: Action Items → Tasks Sync** ✅
   - Internal assignee detection
   - Automatic task creation
   - Sync status = 'synced'
   - task_id populated
   - Proper column names (created_by, follow_up)

5. **Suite 5: External Assignee Exclusion** ✅
   - External email detection
   - No task created
   - Sync status = 'excluded'
   - Proper error message

6. **Suite 6: AI Analysis System** ✅
   - AI columns exist
   - apply_ai_analysis_to_task function exists
   - get_pending_ai_analysis function exists

7. **Suite 7: Meeting Insights** ✅
   - Company insights creation
   - Contact insights creation
   - JSONB data storage

8. **Suite 8: Storage & Assets** ✅
   - meeting-assets bucket exists
   - RLS policies applied

## 🎯 Success Criteria

All tests must show:
- ✅ No SQL errors
- ✅ All assertions pass
- ✅ All functions working
- ✅ All triggers firing
- ✅ Data integrity maintained

## 📝 Test Output Example

```
========================================
TEST SUITE 1: Company Matching
========================================

Test 1.1: Company Creation
✅ Company created: <uuid>
✅ Source tracking verified

🎉 TEST SUITE 1: PASSED

[... continues for all 8 suites ...]

========================================
📊 TEST EXECUTION COMPLETE
========================================

Review the results above for any failures.
All tests should show ✅ PASSED

To clean up test data, run:
SELECT test_reset_data();
```

## 🚀 After Tests Pass

Once all tests pass, you have confirmed:

1. ✅ All 16 migrations working correctly
2. ✅ Company/Contact creation from Fathom
3. ✅ Meeting sync with transcripts
4. ✅ Action item → Task sync (internal only)
5. ✅ External assignee exclusion
6. ✅ AI analysis infrastructure
7. ✅ Meeting insights tracking
8. ✅ Storage bucket configured

**The complete Fathom integration is verified and production-ready!** 🎉

## 📚 Related Documentation

- `TESTING_COMPLETE_SUMMARY.md` - Complete testing summary
- `MIGRATION_ERRORS_AND_FIXES.md` - All fixes applied
- `COLUMN_NAME_REFERENCE.md` - Schema reference
- `RUN_TESTS.md` - Detailed testing guide
