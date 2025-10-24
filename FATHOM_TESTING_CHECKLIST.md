# Fathom Integration - Testing Checklist

Comprehensive testing checklist to verify all Fathom integration functionality works correctly.

## 📋 Pre-Test Verification

### Database Setup
- [ ] All migrations deployed successfully
  ```sql
  -- Verify tables exist
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('fathom_integrations', 'fathom_sync_state', 'fathom_oauth_states', 'meetings')
  ORDER BY table_name;
  ```
- [ ] Meetings table has Fathom columns:
  - `fathom_recording_id` (TEXT UNIQUE)
  - `fathom_user_id` (TEXT)
  - `last_synced_at` (TIMESTAMPTZ)
  - `sync_status` (TEXT)
- [ ] Cron jobs scheduled:
  ```sql
  SELECT jobname, schedule, active FROM cron.job
  WHERE jobname IN ('fathom-hourly-sync', 'cleanup-cron-logs');
  ```

### Edge Functions
- [ ] All 4 functions deployed:
  - `fathom-oauth-initiate`
  - `fathom-oauth-callback`
  - `fathom-sync`
  - `fathom-cron-sync`
- [ ] Functions appear in Supabase Dashboard → Edge Functions

### Environment Configuration
- [ ] Environment secrets set:
  ```bash
  supabase secrets list
  ```
  - `VITE_FATHOM_CLIENT_ID`
  - `VITE_FATHOM_CLIENT_SECRET`
  - `VITE_FATHOM_REDIRECT_URI`
- [ ] Database settings configured:
  ```sql
  SELECT
    current_setting('app.supabase_url', true) as url,
    CASE WHEN current_setting('app.supabase_service_role_key', true) IS NULL
    THEN 'NOT SET' ELSE 'CONFIGURED' END as key_status;
  ```

---

## 🔐 Test 1: OAuth Connection Flow

### Test 1.1: Initial Connection
**Steps:**
1. Navigate to `/integrations` page
2. Locate Fathom card (should show "Not Connected")
3. Click "Connect Fathom Account" button
4. OAuth popup window opens
5. Log in to Fathom (if not already logged in)
6. Authorize application
7. Popup closes automatically
8. Integration page refreshes

**Expected Results:**
- [ ] OAuth popup opens successfully
- [ ] Fathom login/authorization page loads
- [ ] After authorization, popup closes
- [ ] Success toast notification appears
- [ ] Fathom card shows "Connected" badge (green)
- [ ] User email displayed under "Connected As"
- [ ] Token expiration date shown
- [ ] Scopes displayed (should include `public_api`)

**Verify in Database:**
```sql
-- Check integration was created
SELECT
  id,
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  scopes
FROM fathom_integrations
WHERE user_id = auth.uid();

-- Check sync state initialized
SELECT
  sync_status,
  meetings_synced,
  total_meetings_found
FROM fathom_sync_state
WHERE user_id = auth.uid();
```

**Pass Criteria:**
- [ ] Integration record exists with `is_active = true`
- [ ] `fathom_user_email` populated
- [ ] `token_expires_at` is in the future
- [ ] Sync state record exists with `sync_status = 'idle'`

### Test 1.2: Already Connected State
**Steps:**
1. Try connecting again while already connected

**Expected Results:**
- [ ] Edge function returns error: "Integration already exists"
- [ ] UI prevents duplicate connection

---

## 🔄 Test 2: Manual Sync Options

### Test 2.1: Test Sync (Last 5 Calls) - RECOMMENDED FIRST
**Steps:**
1. On Integrations page, click "Test Sync (Last 5)" button
2. Watch sync progress in real-time
3. Verify exactly 5 (or fewer) meetings imported

**Expected Results:**
- [ ] "Test Sync" button shows loading spinner
- [ ] Sync completes in < 10 seconds
- [ ] Maximum 5 meetings synced
- [ ] Sync state updates correctly
- [ ] Success message displayed

**Verify in Database:**
```sql
-- Check meeting count (should be <= 5)
SELECT COUNT(*) as total_meetings
FROM meetings
WHERE owner_user_id = auth.uid();

-- Check the 5 most recent meetings were synced
SELECT
  id,
  title,
  meeting_start,
  last_synced_at
FROM meetings
WHERE owner_user_id = auth.uid()
ORDER BY meeting_start DESC
LIMIT 5;
```

**Pass Criteria:**
- [ ] Total meetings <= 5
- [ ] Only most recent meetings synced
- [ ] Sync completed without errors
- [ ] All 5 meetings have data populated

**Why Test This First?**
✅ Fast (< 10 seconds)
✅ Safe (won't overload database)
✅ Easy to verify (small dataset)
✅ Validates entire pipeline with minimal risk

### Test 2.2: Quick Sync (Last 30 Days)
**Steps:**
1. Ensure you have at least 1 Fathom meeting in last 30 days
2. On Integrations page, click "Quick Sync" button
3. Watch sync progress in real-time

**Expected Results:**
- [ ] "Quick Sync" button shows loading spinner
- [ ] Sync state card updates to show "syncing" status
- [ ] Progress updates in real-time (via Supabase subscriptions)
- [ ] After completion, shows success message
- [ ] "Meetings Synced" count increases
- [ ] Button returns to normal state

**Verify in Database:**
```sql
-- Check sync state updated
SELECT
  sync_status,
  meetings_synced,
  total_meetings_found,
  last_sync_completed_at,
  last_sync_error
FROM fathom_sync_state
WHERE user_id = auth.uid();

-- Check meetings were imported
SELECT
  id,
  fathom_recording_id,
  title,
  meeting_start,
  duration_minutes,
  owner_email,
  summary,
  sentiment_score,
  last_synced_at,
  sync_status
FROM meetings
WHERE owner_user_id = auth.uid()
ORDER BY meeting_start DESC
LIMIT 5;
```

**Pass Criteria:**
- [ ] `sync_status = 'idle'` (not 'syncing' or 'error')
- [ ] `meetings_synced > 0`
- [ ] `total_meetings_found > 0`
- [ ] `last_sync_completed_at` is recent
- [ ] `last_sync_error` is NULL
- [ ] At least 1 meeting in meetings table
- [ ] Meeting has `fathom_recording_id` populated
- [ ] `last_synced_at` is recent
- [ ] `sync_status = 'synced'`

### Test 2.3: Sync with No New Meetings
**Steps:**
1. Run Quick Sync again immediately
2. No new meetings should be found

**Expected Results:**
- [ ] Sync completes successfully
- [ ] `meetings_synced` stays same or increases minimally
- [ ] No errors reported

---

## 📅 Test 3: Custom Date Range Sync

### Test 3.1: All Time Sync
**Steps:**
1. Click "Custom Sync Range" button
2. Select "All Time (Complete history)"
3. Click "Start Sync"
4. Wait for completion (may take several minutes)

**Expected Results:**
- [ ] Modal opens with sync options
- [ ] "All Time" option available
- [ ] Description explains "syncs all meetings"
- [ ] Start Sync button triggers sync
- [ ] Progress updates in real-time
- [ ] All historical meetings imported

**Verify in Database:**
```sql
-- Check total meetings synced
SELECT COUNT(*) as total_meetings
FROM meetings
WHERE owner_user_id = auth.uid();

-- Verify date range coverage
SELECT
  MIN(meeting_start) as earliest_meeting,
  MAX(meeting_start) as latest_meeting,
  COUNT(*) as total
FROM meetings
WHERE owner_user_id = auth.uid();
```

**Pass Criteria:**
- [ ] Total meetings matches expected count from Fathom
- [ ] Date range covers all historical meetings
- [ ] No meetings missing from known list

### Test 3.2: Custom Date Range
**Steps:**
1. Click "Custom Sync Range"
2. Select "Custom Range" option
3. Set start date (e.g., 2024-01-01)
4. Set end date (e.g., 2024-12-31)
5. Click "Start Sync"

**Expected Results:**
- [ ] Date picker inputs appear
- [ ] Can select custom dates
- [ ] Sync imports only meetings within range

**Verify in Database:**
```sql
-- Check meetings are within date range
SELECT
  title,
  meeting_start,
  meeting_end
FROM meetings
WHERE owner_user_id = auth.uid()
  AND meeting_start >= '2024-01-01'
  AND meeting_start < '2025-01-01'
ORDER BY meeting_start DESC;
```

**Pass Criteria:**
- [ ] All meetings fall within specified range
- [ ] No meetings outside range imported

---

## 🎯 Test 4: Meeting Data Integrity

### Test 4.1: Core Meeting Fields
**Verify for sample meeting:**
```sql
SELECT
  fathom_recording_id,
  title,
  meeting_start,
  meeting_end,
  duration_minutes,
  owner_user_id,
  owner_email
FROM meetings
WHERE owner_user_id = auth.uid()
LIMIT 1;
```

**Pass Criteria:**
- [ ] `fathom_recording_id` is unique and non-null
- [ ] `title` populated (meeting name)
- [ ] `meeting_start` has valid timestamp
- [ ] `meeting_end` has valid timestamp
- [ ] `duration_minutes` calculated correctly
- [ ] `owner_user_id` matches authenticated user
- [ ] `owner_email` matches Fathom host email

### Test 4.2: Fathom-Specific Fields
```sql
SELECT
  share_url,
  calls_url,
  transcript_doc_url,
  summary,
  fathom_user_id
FROM meetings
WHERE owner_user_id = auth.uid()
  AND fathom_recording_id IS NOT NULL
LIMIT 1;
```

**Pass Criteria:**
- [ ] `share_url` is valid Fathom share link
- [ ] `calls_url` is valid Fathom app link
- [ ] `transcript_doc_url` populated (if transcript available)
- [ ] `summary` contains AI-generated text (if available)
- [ ] `fathom_user_id` matches integration user

### Test 4.3: Analytics Fields
```sql
SELECT
  sentiment_score,
  coach_summary,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement
FROM meetings
WHERE owner_user_id = auth.uid()
  AND sentiment_score IS NOT NULL
LIMIT 1;
```

**Pass Criteria:**
- [ ] `sentiment_score` between -1 and 1 (if populated)
- [ ] `coach_summary` has text (if available)
- [ ] `talk_time_rep_pct` is percentage 0-100 (if available)
- [ ] `talk_time_customer_pct` is percentage 0-100 (if available)
- [ ] `talk_time_judgement` is 'good', 'high', or 'low' (if calculated)

### Test 4.4: Sync Metadata
```sql
SELECT
  last_synced_at,
  sync_status,
  created_at,
  updated_at
FROM meetings
WHERE owner_user_id = auth.uid()
LIMIT 1;
```

**Pass Criteria:**
- [ ] `last_synced_at` is recent timestamp
- [ ] `sync_status = 'synced'`
- [ ] `created_at` and `updated_at` populated

---

## 👥 Test 5: Meeting Attendees

### Test 5.1: Attendees Imported
```sql
-- Check attendees for a meeting
SELECT
  m.title as meeting_title,
  ma.name,
  ma.email,
  ma.is_external,
  ma.role
FROM meeting_attendees ma
JOIN meetings m ON m.id = ma.meeting_id
WHERE m.owner_user_id = auth.uid()
LIMIT 10;
```

**Pass Criteria:**
- [ ] At least 1 attendee per meeting
- [ ] Host marked as `is_external = false`
- [ ] External attendees marked as `is_external = true`
- [ ] Roles assigned correctly ('host' or 'attendee')
- [ ] Email addresses populated where available

### Test 5.2: Contacts Auto-Created
```sql
-- Check contacts created from attendees
SELECT
  c.name,
  c.email,
  c.source
FROM contacts c
WHERE c.user_id = auth.uid()
  AND c.source = 'fathom_sync'
ORDER BY c.created_at DESC
LIMIT 5;
```

**Pass Criteria:**
- [ ] External attendees with emails created as contacts
- [ ] Source set to `'fathom_sync'`
- [ ] No duplicate contacts for same email

---

## ✅ Test 6: Action Items

### Test 6.1: Action Items Imported
```sql
-- Check action items for meetings
SELECT
  m.title as meeting_title,
  ma.title as action_item,
  ma.category,
  ma.priority,
  ma.ai_generated,
  ma.timestamp_seconds
FROM meeting_action_items ma
JOIN meetings m ON m.id = ma.meeting_id
WHERE m.owner_user_id = auth.uid()
ORDER BY ma.created_at DESC
LIMIT 10;
```

**Pass Criteria:**
- [ ] Action items created from Fathom key moments
- [ ] `ai_generated = true`
- [ ] Category matches moment type ('question', 'objection', 'next_step', 'highlight')
- [ ] Priority assigned ('high' for objections, 'medium' for others)
- [ ] Timestamp populated

---

## 🕐 Test 7: Hourly Cron Sync

### Test 7.1: Manual Cron Trigger
```sql
-- Manually trigger cron sync
SELECT trigger_fathom_hourly_sync();

-- Check logs immediately
SELECT * FROM cron_job_logs
WHERE job_name = 'fathom_hourly_sync'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**
- [ ] Function executes without error
- [ ] Log entry created with status 'triggered'
- [ ] Sync function called for active integrations

**Pass Criteria:**
- [ ] Log shows `status IN ('triggered', 'success')`
- [ ] `error_details` is NULL
- [ ] Message indicates sync was invoked

### Test 7.2: Wait for Scheduled Execution
**Steps:**
1. Note current time
2. Wait until next hour (e.g., 2:00 PM, 3:00 PM)
3. Check if cron ran automatically

```sql
-- Check if cron ran in last hour
SELECT
  created_at,
  status,
  message,
  error_details
FROM cron_job_logs
WHERE job_name = 'fathom_hourly_sync'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Pass Criteria:**
- [ ] New log entry created at top of hour (minute 0)
- [ ] Status is 'success' or 'triggered'
- [ ] No error details

### Test 7.3: Incremental Sync Works
```sql
-- Add new Fathom meeting (in Fathom app)
-- Wait for next hourly sync
-- Check new meeting was imported

SELECT
  title,
  meeting_start,
  last_synced_at
FROM meetings
WHERE owner_user_id = auth.uid()
ORDER BY last_synced_at DESC
LIMIT 5;
```

**Pass Criteria:**
- [ ] New meeting appears after hourly sync
- [ ] Only recent meetings (last 24h) synced
- [ ] `last_synced_at` is very recent

---

## 🎨 Test 8: UI Integration

### Test 8.1: Meetings Page Display
**Steps:**
1. Navigate to `/meetings` page
2. Verify synced meetings display

**Expected Results:**
- [ ] All synced meetings appear in list
- [ ] Meeting cards show correct data
- [ ] Click meeting opens detail view
- [ ] Share URL link works
- [ ] Transcript link works (if available)

### Test 8.2: Real-time Updates
**Steps:**
1. Open Integrations page in one tab
2. Trigger sync
3. Watch for real-time state updates

**Expected Results:**
- [ ] Sync state updates without refresh
- [ ] "Meetings Synced" counter updates live
- [ ] Status badge changes: idle → syncing → idle

---

## 🚨 Test 9: Error Handling

### Test 9.1: Expired Token
**Steps:**
1. Wait for token to expire (or manually expire in DB)
2. Try to sync

```sql
-- Manually expire token for testing
UPDATE fathom_integrations
SET token_expires_at = NOW() - INTERVAL '1 hour'
WHERE user_id = auth.uid();
```

**Expected Results:**
- [ ] Sync fails gracefully
- [ ] Error message indicates token expired
- [ ] User prompted to reconnect

### Test 9.2: API Error Handling
**Steps:**
1. Temporarily break API (wrong credentials, etc.)
2. Attempt sync

**Expected Results:**
- [ ] Error caught and logged
- [ ] `fathom_sync_state.last_sync_error` populated
- [ ] User sees error message
- [ ] Sync status set to 'error'

### Test 9.3: Network Failure
**Steps:**
1. Disconnect internet
2. Try to sync

**Expected Results:**
- [ ] Error handled gracefully
- [ ] User notified of network issue
- [ ] Can retry when connection restored

---

## 🔒 Test 10: Security & Permissions

### Test 10.1: RLS Policies
```sql
-- Try to see another user's integration (should fail)
SELECT * FROM fathom_integrations
WHERE user_id != auth.uid();

-- Should return no rows (RLS blocks access)
```

**Pass Criteria:**
- [ ] Cannot see other users' integrations
- [ ] Cannot see other users' meetings
- [ ] Cannot modify other users' data

### Test 10.2: Token Security
```sql
-- Verify tokens are stored (not exposed in frontend)
SELECT
  id,
  user_id,
  fathom_user_email,
  -- access_token and refresh_token should NOT be in SELECT results
  is_active
FROM fathom_integrations
WHERE user_id = auth.uid();
```

**Pass Criteria:**
- [ ] Tokens not exposed in client queries
- [ ] Only Edge Functions can access tokens
- [ ] Service role required for token access

---

## 🔧 Test 11: Disconnect & Reconnect

### Test 11.1: Disconnect Integration
**Steps:**
1. Click "Disconnect Fathom" button
2. Confirm disconnection

**Expected Results:**
- [ ] Integration marked as `is_active = false`
- [ ] "Connected" badge changes to "Not Connected"
- [ ] Sync state preserved (for potential reconnection)
- [ ] Existing meetings NOT deleted

**Verify in Database:**
```sql
SELECT is_active FROM fathom_integrations WHERE user_id = auth.uid();
-- Should be false

SELECT COUNT(*) FROM meetings WHERE owner_user_id = auth.uid();
-- Should still have meetings
```

### Test 11.2: Reconnect After Disconnect
**Steps:**
1. After disconnecting, click "Connect Fathom" again
2. Complete OAuth flow

**Expected Results:**
- [ ] New integration created OR existing reactivated
- [ ] Previous meetings still visible
- [ ] Can sync new meetings

---

## 📊 Final Validation

### Checklist Summary
Run this comprehensive check after all tests:

```sql
-- Integration Health Check
WITH health AS (
  SELECT
    fi.is_active,
    fi.token_expires_at > NOW() as token_valid,
    fs.sync_status = 'idle' as sync_idle,
    fs.meetings_synced > 0 as has_synced,
    fs.last_sync_error IS NULL as no_errors,
    EXISTS(SELECT 1 FROM meetings WHERE owner_user_id = auth.uid()) as has_meetings,
    EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'fathom-hourly-sync' AND active = true) as cron_active
  FROM fathom_integrations fi
  LEFT JOIN fathom_sync_state fs ON fs.integration_id = fi.id
  WHERE fi.user_id = auth.uid()
)
SELECT
  CASE WHEN is_active THEN '✅' ELSE '❌' END as integration_active,
  CASE WHEN token_valid THEN '✅' ELSE '⚠️' END as token_status,
  CASE WHEN sync_idle THEN '✅' ELSE '⚠️' END as sync_status,
  CASE WHEN has_synced THEN '✅' ELSE '❌' END as synced_meetings,
  CASE WHEN no_errors THEN '✅' ELSE '❌' END as no_sync_errors,
  CASE WHEN has_meetings THEN '✅' ELSE '❌' END as meetings_in_db,
  CASE WHEN cron_active THEN '✅' ELSE '❌' END as cron_scheduled
FROM health;
```

**All checks should show ✅ for a fully working integration**

---

## 🎯 Success Criteria

Integration is considered **FULLY FUNCTIONAL** when:

- [ ] **OAuth**: Can connect and disconnect without errors
- [ ] **Quick Sync**: Successfully syncs last 30 days
- [ ] **All Time Sync**: Imports complete meeting history
- [ ] **Data Integrity**: All meeting fields populated correctly
- [ ] **Attendees**: External participants imported as attendees and contacts
- [ ] **Action Items**: AI-generated items created from key moments
- [ ] **Hourly Cron**: Automatic sync runs every hour
- [ ] **UI**: Meetings display correctly in dashboard
- [ ] **Real-time**: State updates without page refresh
- [ ] **Security**: RLS policies prevent unauthorized access
- [ ] **Error Handling**: Failures handled gracefully with clear messages

---

## 📝 Test Report Template

```
# Fathom Integration Test Report

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: [Production/Staging/Local]

## Test Results Summary

- Total Tests: 11 categories
- Tests Passed: __/11
- Tests Failed: __/11
- Blockers Found: [Number]

## Detailed Results

### ✅ Passing Tests
- [List tests that passed]

### ❌ Failing Tests
- [List tests that failed with details]

### 🐛 Bugs Found
1. [Bug description]
   - **Severity**: Critical/High/Medium/Low
   - **Steps to Reproduce**:
   - **Expected**:
   - **Actual**:

## Recommendations

[Any recommendations for improvements or fixes]

## Sign-off

**Ready for Production**: Yes/No

**Tested by**: [NAME]
**Date**: [DATE]
```
