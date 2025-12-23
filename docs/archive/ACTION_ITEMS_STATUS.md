# Action Items - Current Status & Next Steps

## 🔍 Current Findings

### Confirmed Facts:
1. ✅ Bulk API (`/external/v1/calls`) returns `action_items: null` for ALL meetings
2. ✅ This is EXPECTED - bulk API doesn't include action items
3. ✅ Code correctly calls individual recording endpoint for each meeting
4. ❌ Individual recording endpoint (`/external/v1/recordings/{id}`) also returns no action items

### Log Evidence (Version 26):
```json
{
  "recording_id": 96272358,
  "title": "60 Seconds",
  "share_url": "https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz",
  "action_items": null  // <-- The problem
}
```

**User Confirmed**: This meeting has 3 action items visible in Fathom UI

---

## 🎯 What We Need

### Version 27 Deployed with Enhanced Logging

New logs will show:
```
📦 API Response keys: [all available fields]
📋 action_items field type: [type], value: [actual value]
```

This will tell us:
1. **What fields are actually available** in the recording details response
2. **The exact format** of the action_items field (null, [], missing, etc.)
3. **If action items exist under a different name** (actionItems, tasks, etc.)

---

## 🧪 Test Cases

### Meeting 1: "60 Seconds"
- **Recording ID**: 96272358
- **Share URL**: https://fathom.video/share/QX4zNf5vPfVRMFi-m9yP2vnqDNzFeoZz
- **Expected**: 3 action items
- **Actual**: 0 (action_items: null)

### Meeting 2: "60 Seconds / Follow Up"
- **Recording ID**: 96397021
- **Share URL**: https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf
- **Expected**: 2 action items
- **Actual**: 0 (action_items: null)

---

## 💡 Possible Explanations

### Hypothesis 1: Timing/Processing Delay
**Theory**: Action items are generated asynchronously and not immediately available via API

**Evidence Against**:
- Meetings are days old (Oct 22-23)
- Action items visible in Fathom UI

**Conclusion**: Unlikely

### Hypothesis 2: Different API Endpoint Required
**Theory**: Action items require a specific endpoint like `/recordings/{id}/action_items`

**Previous Test**:
- Tried this endpoint → 404 errors
- Changed to `/recordings/{id}` → No errors but action_items: null

**Status**: User confirmed action items should be in recording details response

### Hypothesis 3: API Permissions/Feature Flag
**Theory**: Integration doesn't have permission to access action items

**Test Needed**:
- Check Fathom integration settings
- Verify action items feature is enabled for account
- Check if API token has correct scopes

### Hypothesis 4: Action Items in Different Field
**Theory**: Fathom changed the API format and action items are under a different key

**Test Needed**:
- V27 logs will show ALL available fields
- Look for: `actionItems`, `action_item_list`, `tasks`, `todos`, etc.

### Hypothesis 5: Transcript Required First
**Theory**: Action items only available after transcript is processed

**Evidence**:
- Log shows: `"transcript": null` for all meetings
- Action items might depend on transcript

**Test Needed**:
- Check if meetings with transcripts have action items
- Verify transcript processing is complete

---

## 📋 Action Plan

### Step 1: Trigger New Sync ⏳
**Purpose**: Get v27 logs with enhanced diagnostic output

**Look For**:
```
📦 API Response keys: [field1, field2, field3, ...]
📋 action_items field type: [null/array/object], value: [...]
```

### Step 2: Analyze Response Structure ⏳
**Questions to Answer**:
1. What fields are available in the response?
2. Is there an action items field (any variation of the name)?
3. What is the exact structure returned?
4. Are there any nested objects we should check?

### Step 3: Check Transcript Status ⏳
**Query**:
```sql
SELECT
  fathom_recording_id,
  title,
  transcript IS NOT NULL as has_transcript,
  transcript_doc_url
FROM meetings
WHERE fathom_recording_id IN (96272358, 96397021);
```

**Purpose**: See if transcript processing affects action items availability

### Step 4: Test with Known Working Meeting ⏳
**Find a meeting that**:
- Has action items visible in Fathom UI
- Is at least 24 hours old
- Has transcript processed
- External attendees (not internal-only)

### Step 5: Check Fathom Account Settings ⏳
**Verify**:
- Action items feature is enabled
- Integration has correct permissions
- API token has necessary scopes
- No account-level restrictions

---

## 🚨 If Action Items Still Don't Work

### Fallback Option 1: Parse from Transcript
If action items aren't available via API, we could:
1. Get transcript from Fathom
2. Use AI/LLM to extract action items from transcript
3. Store in our database

**Pros**: Guaranteed to work if transcript available
**Cons**: More complex, requires AI processing

### Fallback Option 2: Manual Entry
Allow users to manually add action items to meetings

**Pros**: Simple, always works
**Cons**: Not automated

### Fallback Option 3: Contact Fathom Support
Ask Fathom API team about:
- Correct endpoint for action items
- Required permissions/scopes
- API format changes

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Bulk API | ✅ Working | Returns meetings, no action items (expected) |
| Recording Details API | ✅ Working | Returns 200 OK, but action_items: null |
| Action Items Parsing | ✅ Ready | Code ready to handle action items when available |
| Database Schema | ✅ Ready | meeting_action_items table exists |
| Frontend Display | ✅ Ready | UI ready to show action items |
| RLS Policies | ✅ Fixed | Policies allow action items to display |
| **API Returns Data** | ❌ **Not Working** | action_items field is null |

---

## 🎯 Next Immediate Action

**Trigger a new Fathom sync** to get v27 logs showing:
1. Complete list of API response fields
2. Exact action_items field format
3. Any alternative field names we should check

Once we see these logs, we'll know exactly what the API is returning and can adjust our code accordingly.

---

**Version**: Investigating (v27 deployed, awaiting test)
**Status**: Waiting for v27 diagnostic logs
**Blocker**: Need to see actual API response structure from individual recording endpoint
