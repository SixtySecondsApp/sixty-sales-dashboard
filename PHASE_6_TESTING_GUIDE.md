# Phase 6 Testing Guide - Extraction Customization

**Project:** Sixty v1 (Meetings)  
**Project ID:** `7a62ba1e-74c5-4c57-801b-b15e82ab1ecc`  
**Branch:** `meetings-feature-v1`  
**Phase:** Phase 6 - Extraction Customization

---

## 🎯 Overview

Phase 6 allows users to create custom extraction rules that automatically extract tasks from meeting transcripts based on trigger phrases. This guide covers testing:

1. **Phase 6.1** - Database tables and backend service
2. **Phase 6.2** - Extraction Rules UI (`/settings/extraction-rules`)
3. **Phase 6.3** - Integration with edge functions (automatic task extraction)

---

## 🚀 Quick Setup

1. **Ensure you're on the correct branch:**
   ```bash
   git checkout meetings-feature-v1
   ```

2. **Verify migration is applied:**
   ```sql
   -- Check if tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('task_extraction_rules', 'meeting_type_templates');
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:** http://localhost:5173

---

## 📋 Phase 6.1 Testing - Database & Backend Service

### Test 1: Verify Database Tables

**SQL Query:**
```sql
-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'task_extraction_rules'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'task_extraction_rules';
```

**Expected Results:**
- ✅ Table `task_extraction_rules` exists with columns: id, user_id, name, trigger_phrases, task_category, default_priority, default_deadline_days, is_active, created_at, updated_at
- ✅ Table `meeting_type_templates` exists
- ✅ RLS policies exist for SELECT, INSERT, UPDATE, DELETE
- ✅ Indexes exist on `user_id` and `(user_id, is_active)`

### Test 2: Test Service Methods

**In Browser Console (on `/settings/extraction-rules` page):**

```javascript
// Test getting rules (should return empty array initially)
const { data: rules } = await supabase
  .from('task_extraction_rules')
  .select('*')
  .eq('user_id', 'your-user-id');
console.log('Rules:', rules);

// Test creating a rule
const { data: newRule, error } = await supabase
  .from('task_extraction_rules')
  .insert({
    user_id: 'your-user-id',
    name: 'Test Rule',
    trigger_phrases: ['follow up', 'send quote'],
    task_category: 'follow_up',
    default_priority: 'high',
    default_deadline_days: 3,
    is_active: true
  })
  .select()
  .single();
console.log('Created rule:', newRule, error);
```

**Expected Results:**
- ✅ Can query rules
- ✅ Can create new rule
- ✅ Can update rule
- ✅ Can delete rule
- ✅ Can toggle `is_active` status

---

## 📋 Phase 6.2 Testing - Extraction Rules UI

### Test 1: Access Extraction Rules Page

**URL:** `http://localhost:5173/settings/extraction-rules`

**Navigation Paths:**
1. Direct URL: `/settings/extraction-rules`
2. From AI Settings: `/settings/ai` → Click "Extraction Rules" tab → Click "Go to Extraction Rules" button
3. From Settings: Check if there's a link in settings menu

**Expected Results:**
- ✅ Page loads without errors
- ✅ Shows empty state if no rules exist
- ✅ Shows "Create Your First Rule" button

### Test 2: Create a New Extraction Rule

**Steps:**
1. Click "New Rule" button
2. Fill in the form:
   - **Rule Name:** "Follow-up on Pricing"
   - **Trigger Phrases:** 
     - "follow up"
     - "send quote"
     - "pricing discussion"
   - **Task Category:** "follow_up"
   - **Default Priority:** "high"
   - **Default Deadline:** 3 days
   - **Active:** Toggle ON
3. Click "Create Rule"

**Expected Results:**
- ✅ Form appears when clicking "New Rule"
- ✅ Can add multiple trigger phrases
- ✅ Can remove trigger phrases
- ✅ All fields save correctly
- ✅ Success toast appears
- ✅ Rule appears in list after creation
- ✅ Rule shows correct badges (category, priority, active status)

### Test 3: Edit an Existing Rule

**Steps:**
1. Click edit icon (pencil) on an existing rule
2. Modify fields:
   - Change priority to "medium"
   - Add another trigger phrase: "get back to you"
   - Change deadline to 5 days
3. Click "Save"

**Expected Results:**
- ✅ Rule card switches to edit mode
- ✅ Can modify all fields
- ✅ Changes save correctly
- ✅ Success toast appears
- ✅ Updated rule displays correctly

### Test 4: Delete a Rule

**Steps:**
1. Click delete icon (trash) on an existing rule
2. Confirm deletion in dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Rule is deleted after confirmation
- ✅ Success toast appears
- ✅ Rule disappears from list

### Test 5: Toggle Rule Active/Inactive

**Steps:**
1. Create a rule with `is_active: true`
2. Edit the rule
3. Toggle "Active" switch to OFF
4. Save

**Expected Results:**
- ✅ Toggle works correctly
- ✅ Inactive rules show "Inactive" badge
- ✅ Active rules show "Active" badge
- ✅ Status persists after page refresh

### Test 6: Meeting Type Templates Tab

**Steps:**
1. Click "Meeting Type Templates" tab
2. Click "New Template"
3. Select meeting type: "discovery"
4. Add JSON for extraction_template and content_templates
5. Save

**Expected Results:**
- ✅ Tab switches correctly
- ✅ Can create templates for different meeting types
- ✅ JSON editors work (validate JSON)
- ✅ Templates save correctly
- ✅ Can edit existing templates

### Test 7: Validation & Error Handling

**Test Cases:**
1. Try to create rule without name → Should show error
2. Try to create rule without trigger phrases → Should show error
3. Try to create rule without category → Should show error
4. Try invalid JSON in template editor → Should show error

**Expected Results:**
- ✅ Validation prevents invalid submissions
- ✅ Error messages are clear and helpful
- ✅ Form doesn't submit with invalid data

---

## 📋 Phase 6.3 Testing - Edge Function Integration

### Prerequisites

Before testing integration, ensure:
1. You have at least one active extraction rule created
2. You have a meeting with a transcript that contains your trigger phrases
3. Edge functions are deployed (or running locally)

### Test 1: Test Rule Matching in suggest-next-actions

**Setup:**
1. Create an extraction rule with trigger phrase: "follow up"
2. Find or create a meeting with transcript containing "follow up"

**Steps:**
1. Navigate to meeting detail page: `/meetings/{meeting-id}`
2. Check if "Next Action Suggestions" section exists
3. If no suggestions exist, trigger extraction:
   - Click "Extract More Tasks" button (if available)
   - OR manually call the edge function

**Manual Edge Function Test:**
```javascript
// In browser console
const { data, error } = await supabase.functions.invoke('suggest-next-actions', {
  body: {
    activityId: 'your-meeting-id',
    activityType: 'meeting',
    forceRegenerate: true
  }
});
console.log('Suggestions:', data);
```

**Expected Results:**
- ✅ Edge function returns suggestions
- ✅ Rule-based suggestions appear with `source: 'custom_rule'`
- ✅ Rule-based suggestions have correct:
  - Title (from matching sentence)
  - Category (from rule)
  - Priority (from rule)
  - Deadline (calculated from rule's `default_deadline_days`)
  - High confidence score (0.95)
- ✅ Rule-based suggestions appear BEFORE AI suggestions
- ✅ No duplicates between rule-based and AI suggestions

### Test 2: Test Rule Matching in fathom-sync

**Setup:**
1. Create an extraction rule with trigger phrase: "send proposal"
2. Sync a new meeting from Fathom that contains "send proposal" in transcript

**Steps:**
1. Sync a meeting from Fathom (via Integrations page or manual sync)
2. Wait for sync to complete
3. Check meeting action items:

```sql
-- Check action items created from extraction rules
SELECT 
  mai.id,
  mai.title,
  mai.category,
  mai.priority,
  mai.deadline_at,
  mai.ai_generated,
  ter.name as rule_name
FROM meeting_action_items mai
LEFT JOIN task_extraction_rules ter ON ter.id::text = mai.metadata->>'matchedRuleId'
WHERE mai.meeting_id = 'your-meeting-id'
ORDER BY mai.created_at DESC;
```

**Expected Results:**
- ✅ Action items are created from matched rules
- ✅ Action items have correct category, priority, deadline
- ✅ Action items are merged with AI-extracted items
- ✅ No duplicates

### Test 3: Test Rule Matching in extract-action-items

**Setup:**
1. Create an extraction rule with trigger phrase: "schedule demo"
2. Find a meeting with transcript containing "schedule demo"

**Steps:**
1. Navigate to meeting detail page
2. Click "Get Action Items" button (if available)
3. Check created action items

**Expected Results:**
- ✅ Action items created from rules
- ✅ Correct metadata (category, priority, deadline)
- ✅ Merged with AI-extracted items

### Test 4: Test Multiple Rules Matching

**Setup:**
1. Create multiple active rules:
   - Rule 1: "follow up" → category: "follow_up"
   - Rule 2: "send quote" → category: "proposal"
   - Rule 3: "schedule meeting" → category: "meeting"
2. Create a transcript containing all three phrases

**Steps:**
1. Process a meeting transcript with all trigger phrases
2. Check created tasks/suggestions

**Expected Results:**
- ✅ All matching rules create tasks
- ✅ Each task has correct category from its rule
- ✅ No duplicates
- ✅ Tasks appear in correct order (rule-based first)

### Test 5: Test Inactive Rules

**Setup:**
1. Create a rule with trigger phrase: "test phrase"
2. Set `is_active: false`
3. Create a transcript containing "test phrase"

**Steps:**
1. Process transcript with inactive rule trigger phrase

**Expected Results:**
- ✅ Inactive rule does NOT create tasks
- ✅ Only active rules are matched

### Test 6: Test Rule Priority Over AI

**Setup:**
1. Create a rule: "send proposal" → category: "proposal", priority: "high"
2. Process a transcript containing "send proposal"
3. AI might also extract a similar task

**Expected Results:**
- ✅ Rule-based task appears first
- ✅ AI task is deduplicated if similar
- ✅ Rule-based task takes precedence

### Test 7: Test Edge Cases

**Test Cases:**

1. **Empty Transcript:**
   - Process meeting with empty/null transcript
   - **Expected:** No errors, no tasks created

2. **No Matching Rules:**
   - Process transcript with no trigger phrases
   - **Expected:** Only AI-extracted tasks (if any)

3. **Rule with No Deadline:**
   - Create rule with `default_deadline_days: null`
   - **Expected:** Task created without deadline or with default deadline

4. **Very Long Transcript:**
   - Process transcript with 10,000+ characters
   - **Expected:** Rules still match correctly

5. **Special Characters in Trigger Phrases:**
   - Create rule with trigger: "don't forget"
   - **Expected:** Matching works correctly

---

## 🔍 Verification Queries

### Check Extraction Rules

```sql
-- List all extraction rules for a user
SELECT 
  id,
  name,
  trigger_phrases,
  task_category,
  default_priority,
  default_deadline_days,
  is_active,
  created_at
FROM task_extraction_rules
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

### Check Tasks Created from Rules

```sql
-- Find tasks created from extraction rules
SELECT 
  t.id,
  t.title,
  t.task_type,
  t.priority,
  t.due_date,
  t.metadata->>'matchedRuleId' as rule_id,
  t.metadata->>'source' as source,
  ter.name as rule_name
FROM tasks t
LEFT JOIN task_extraction_rules ter ON ter.id::text = t.metadata->>'matchedRuleId'
WHERE t.metadata->>'source' = 'custom_rule'
  AND t.user_id = 'your-user-id'
ORDER BY t.created_at DESC
LIMIT 20;
```

### Check Suggestions Created from Rules

```sql
-- Find suggestions created from extraction rules
SELECT 
  nas.id,
  nas.title,
  nas.action_type,
  nas.urgency,
  nas.recommended_deadline,
  nas.confidence_score,
  nas.metadata->>'matchedRuleId' as rule_id,
  nas.metadata->>'source' as source,
  ter.name as rule_name
FROM next_action_suggestions nas
LEFT JOIN task_extraction_rules ter ON ter.id::text = nas.metadata->>'matchedRuleId'
WHERE nas.metadata->>'source' = 'custom_rule'
  AND nas.activity_id = 'your-meeting-id'
ORDER BY nas.created_at DESC;
```

---

## 🐛 Troubleshooting

### "Extraction rules page doesn't load"
- Check browser console for errors
- Verify route exists: `/settings/extraction-rules`
- Check if `ExtractionRules.tsx` file exists
- Verify user is logged in

### "Rules aren't matching transcripts"
- Verify rule is active (`is_active: true`)
- Check trigger phrases match exactly (case-insensitive)
- Verify transcript exists and contains trigger phrases
- Check edge function logs for errors

### "Tasks aren't being created from rules"
- Verify edge function integration is deployed
- Check edge function logs
- Verify `userId` is being passed to edge functions
- Check database for created tasks/suggestions

### "Rule-based tasks have wrong category/priority"
- Verify rule configuration in database
- Check edge function code for correct field mapping
- Verify rule is being matched correctly

### "Duplicate tasks being created"
- Check deduplication logic in edge functions
- Verify merge functions are working correctly
- Check if both rule-based and AI tasks are being created for same item

---

## ✅ Testing Checklist

### Phase 6.1 - Database & Service ✅
- [ ] Database tables exist with correct schema
- [ ] RLS policies work correctly
- [ ] Indexes exist for performance
- [ ] Service methods work (get, create, update, delete)
- [ ] Rule matching logic works

### Phase 6.2 - UI ✅
- [ ] Page loads correctly
- [ ] Can create new rules
- [ ] Can edit existing rules
- [ ] Can delete rules
- [ ] Can toggle active/inactive
- [ ] Validation works
- [ ] Meeting type templates work
- [ ] UI is responsive

### Phase 6.3 - Integration ✅
- [ ] Rules work in `suggest-next-actions`
- [ ] Rules work in `fathom-sync`
- [ ] Rules work in `extract-action-items`
- [ ] Multiple rules match correctly
- [ ] Inactive rules don't trigger
- [ ] Rule-based tasks have correct metadata
- [ ] Deduplication works
- [ ] Rule priority over AI works
- [ ] Edge cases handled correctly

---

## 📝 Test Data Examples

### Sample Extraction Rule

```json
{
  "name": "Follow-up on Pricing",
  "trigger_phrases": [
    "follow up",
    "send quote",
    "pricing discussion",
    "get back to you"
  ],
  "task_category": "follow_up",
  "default_priority": "high",
  "default_deadline_days": 3,
  "is_active": true
}
```

### Sample Transcript (for testing)

```
"Hi John, thanks for taking the time today. I wanted to follow up on our pricing discussion from last week. 
Can you send quote for the enterprise package? I'll get back to you by Friday with our decision. 
Also, let's schedule a demo for next week to see the product in action."
```

**Expected Matches:**
- "follow up" → Creates task: "Follow up on our pricing discussion"
- "send quote" → Creates task: "Can you send quote for the enterprise package"
- "schedule demo" → Creates task: "let's schedule a demo for next week"

---

**Last Updated:** 2025-01-27  
**Branch:** `meetings-feature-v1`  
**Phase:** 6 - Extraction Customization

















