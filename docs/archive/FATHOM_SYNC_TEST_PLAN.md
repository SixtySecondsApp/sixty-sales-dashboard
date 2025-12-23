# Fathom Sync - Comprehensive Test Plan

## Status: Ready for Testing
**Version Deployed**: v25 (all schema fixes applied)

---

## 🎯 Test Objectives

Verify all 4 critical issues are resolved:
1. ✅ Missing thumbnails (fixed - 100% coverage confirmed)
2. ⏳ Action items not syncing (fixed - pending verification)
3. ✅ Duplicate attendees (fixed - 0 duplicates confirmed)
4. ⏳ Contact creation errors (fixed - pending full verification)

---

## 📋 Pre-Test Checklist

- [ ] Edge Function v25 deployed successfully
- [ ] All schema fixes applied (contacts, activities tables)
- [ ] RLS policies updated for action items
- [ ] Shared utility files updated (primaryContactSelection.ts, companyMatching.ts)

---

## 🧪 Test Procedure

### Step 1: Trigger Fresh Fathom Sync

Navigate to the Fathom integration settings in the application and trigger a manual sync.

**Expected Behavior**:
- Sync completes without errors
- All meetings imported successfully
- No console errors in browser or Edge Function logs

---

### Step 2: Verify Thumbnails (Already Confirmed Working)

Run this SQL query:

```sql
SELECT
  COUNT(*) as total_fathom_meetings,
  COUNT(CASE WHEN thumbnail_url IS NOT NULL THEN 1 END) as with_thumbnails,
  ROUND(COUNT(CASE WHEN thumbnail_url IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) as coverage_pct
FROM meetings
WHERE fathom_recording_id IS NOT NULL;
```

**Expected Result**: 100% thumbnail coverage (all meetings have thumbnails)

**Status**: ✅ CONFIRMED WORKING (10/10 meetings have thumbnails)

---

### Step 3: Verify Action Items (Critical Test)

#### 3A. Check Total Action Items

```sql
SELECT
  COUNT(*) as total_action_items,
  COUNT(DISTINCT meeting_id) as meetings_with_items
FROM meeting_action_items;
```

**Expected Result**:
- `total_action_items` > 2 (should be significantly more than the current 2)
- `meetings_with_items` > 1 (multiple meetings should have action items)

**Current Status**: Only 2 action items total (NEEDS IMPROVEMENT)

#### 3B. Check Specific Meetings

Check the two meetings with known action items in Fathom:

**Meeting 1**: https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf
- Expected: 2 action items

**Meeting 2**: https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz
- Meeting ID: `340398c2-2c5b-4f5b-a67b-7dc66443c320`
- Expected: 3 action items

```sql
-- Check action items for specific meetings
SELECT
  m.id,
  m.title,
  m.share_url,
  mai.title as action_item_title,
  mai.timestamp_seconds,
  mai.ai_generated,
  mai.completed,
  mai.category
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.id IN (
  '340398c2-2c5b-4f5b-a67b-7dc66443c320',
  '2a6e6f7b-f1e7-4c1f-aa8e-29ffabc276ad'
)
ORDER BY m.meeting_start DESC, mai.timestamp_seconds;
```

**Expected Result**: Should see 3 action items for meeting `340398c2-2c5b-4f5b-a67b-7dc66443c320`

#### 3C. Check Frontend Display

Navigate to: http://localhost:5173/meetings/340398c2-2c5b-4f5b-a67b-7dc66443c320

**Expected Behavior**:
- 3 action items displayed in the UI
- Action items match those from Fathom
- Click on action items to verify playback URLs work

---

### Step 4: Verify No Duplicate Attendees

```sql
SELECT
  meeting_id,
  email,
  name,
  COUNT(*) as duplicate_count
FROM meeting_attendees
WHERE email IS NOT NULL
GROUP BY meeting_id, email, name
HAVING COUNT(*) > 1;
```

**Expected Result**: 0 rows (no duplicates)

**Status**: ✅ CONFIRMED WORKING (0 duplicate attendees found)

---

### Step 5: Verify Contact Creation

#### 5A. Check Total Fathom Contacts

```sql
SELECT
  COUNT(*) as total_fathom_contacts,
  COUNT(DISTINCT company_id) as unique_companies
FROM contacts
WHERE source = 'fathom_meeting';
```

**Expected Result**:
- `total_fathom_contacts` ≥ 9 (we created 9 in the last sync)
- Should increase with each sync as new external participants are found

**Current Status**: 9 Fathom contacts created (up from 0)

#### 5B. Verify Contact Schema

Check that contacts have proper data:

```sql
SELECT
  first_name,
  last_name,
  full_name,
  email,
  company_id,
  owner_id,
  source
FROM contacts
WHERE source = 'fathom_meeting'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**:
- All contacts have `first_name`, `last_name` populated
- No `name` field errors
- All contacts have `owner_id` (not `user_id`)
- All contacts have valid `company_id`

---

### Step 6: Verify Activities Created

```sql
SELECT
  a.id,
  a.type,
  a.status,
  a.client_name,
  a.date,
  a.meeting_id,
  m.fathom_recording_id
FROM activities a
JOIN meetings m ON m.id = a.meeting_id
WHERE m.fathom_recording_id IS NOT NULL
ORDER BY a.date DESC
LIMIT 10;
```

**Expected Result**:
- Activities created for each Fathom meeting
- No `duration_minutes` errors in logs
- All activities have proper `user_id`, `meeting_id`, `contact_id`, `company_id`

---

### Step 7: Check Edge Function Logs

Check for any errors or warnings:

```bash
# In Supabase dashboard, check Edge Function logs for fathom-sync
# Look for:
# ✅ "Successfully synced X meetings"
# ✅ "Created new company: [Company Name]"
# ✅ "Inserted action item: [Item Title]"
# ❌ NO schema errors (contacts.name, activities.duration_minutes, etc.)
# ❌ NO duplicate key violations
```

---

## 🎯 Success Criteria

### Must Pass (Critical):
- [ ] All meetings have thumbnails (100% coverage)
- [ ] Action items sync correctly (≥3 items for meeting 340398c2-2c5b-4f5b-a67b-7dc66443c320)
- [ ] 0 duplicate attendees
- [ ] Contacts created without schema errors
- [ ] Activities created without schema errors
- [ ] No Edge Function errors in logs

### Should Pass (Important):
- [ ] Action items display correctly in frontend
- [ ] Action item playback URLs work
- [ ] Company matching works (no duplicate domain errors)
- [ ] Primary contact selection works correctly

---

## 🐛 Known Issues & Fixes Applied

### Issue 1: Missing Thumbnails ✅ FIXED
**Root Cause**: Line 858 required `share_url` before generating placeholder
**Fix**: Removed conditional - always generate placeholder if no thumbnail
**Result**: 100% thumbnail coverage confirmed

### Issue 2: Action Items Not Syncing ✅ FIXED (PENDING VERIFICATION)
**Root Cause**: Using wrong API endpoint `/recordings/{id}/action_items`
**Fix**: Changed to `/recordings/{id}` for full recording details
**Additional Fix**: Updated parsing logic for new API format
**Status**: Code deployed, awaiting test results

### Issue 3: Duplicate Attendees ✅ FIXED
**Root Cause**: Creating entries in multiple tables for same person
**Fix**: Separated internal vs external participant logic
**Result**: 0 duplicates confirmed

### Issue 4: Contact Schema Errors ✅ FIXED
**Root Cause**: Using `name` instead of `first_name/last_name`, `user_id` instead of `owner_id`
**Fix**: Updated all 3 files (fathom-sync, primaryContactSelection, companyMatching)
**Result**: 9 contacts created, awaiting more

### Issue 5: RLS Policies Blocking Display ✅ FIXED
**Root Cause**: Conflicting RLS policies on meeting_action_items
**Fix**: Applied FIX_ACTION_ITEMS_RLS.sql
**Result**: Frontend can now display action items

### Issue 6: Activities Schema Error ✅ FIXED
**Root Cause**: Inserting non-existent `duration_minutes` field
**Fix**: Removed field from insert statement
**Result**: Deployed in v25, awaiting test

---

## 📊 Expected Test Results Summary

| Test | Current Status | Expected After Test |
|------|---------------|---------------------|
| Thumbnails | ✅ 100% (10/10) | ✅ 100% coverage maintained |
| Action Items | ⚠️ 2 total | ✅ 5+ items across multiple meetings |
| Duplicate Attendees | ✅ 0 duplicates | ✅ 0 duplicates maintained |
| Fathom Contacts | ⚠️ 9 created | ✅ ≥20 contacts with proper schema |
| Activities | ⚠️ Unknown | ✅ Activities for all meetings |
| Edge Function Logs | ⚠️ Had errors | ✅ No errors |

---

## 🚨 Troubleshooting Guide

### If Action Items Still Not Syncing:

1. **Check Fathom API Response**:
   - Verify the full recording details endpoint returns action items
   - Check if `action_items` field exists and is populated
   - Verify format matches our parsing logic

2. **Check Edge Function Logs**:
   - Look for "Fetching full recording details" messages
   - Check for "Found X action items" log entries
   - Look for any 404 or authentication errors

3. **Check Database**:
   - Verify action items are being inserted (check for insert errors)
   - Check RLS policies allow SELECT for current user
   - Verify meeting IDs match between tables

### If Contacts Still Have Errors:

1. **Check Schema**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'contacts';
   ```

2. **Check Edge Function Logs**:
   - Look for "Created contact:" messages
   - Check for any duplicate email violations
   - Look for schema mismatch errors

### If Activities Have Errors:

1. **Check Schema**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'activities';
   ```

2. **Verify Insert Fields**:
   - Ensure only valid columns are being inserted
   - Check for any NOT NULL constraint violations

---

## 📝 Next Steps After Testing

1. **If All Tests Pass**:
   - Mark all issues as resolved ✅
   - Update documentation
   - Close related tickets
   - Monitor for any edge cases

2. **If Action Items Still Missing**:
   - Provide Edge Function logs showing API response
   - Share database query results
   - Check specific meeting IDs with known action items

3. **If Other Issues Found**:
   - Document new issues with specific examples
   - Provide logs and error messages
   - Run diagnostic queries

---

## 🎉 Success Metrics

Once testing is complete, we should see:
- **100%** thumbnail coverage across all Fathom meetings
- **≥5** action items synced from Fathom (currently 2)
- **0** duplicate attendees in any meeting
- **≥20** Fathom contacts created with correct schema
- **0** Edge Function errors in logs
- **100%** of meetings have associated activities

---

## 📞 Support

If you encounter any issues during testing:
1. Share the Edge Function logs (last 50 lines)
2. Run the verification SQL queries and share results
3. Note any specific error messages or unexpected behavior
4. Check browser console for frontend errors

---

**Version**: v25
**Date**: 2025-10-26
**Status**: Ready for comprehensive testing
