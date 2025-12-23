# Action Item Extraction - Improved Prompt

## Problem
No action items were being extracted from sales call transcripts, even though meetings clearly had next steps and commitments.

## Root Cause
The original AI prompt was too conservative and didn't explicitly instruct Claude to look for:
1. **Both parties' action items** (rep AND customer tasks)
2. **Implicit commitments** (not just explicit "I will..." statements)
3. **Common sales follow-ups** (send proposal, schedule demo, etc.)

## Solution - Enhanced Prompt

### Key Improvements

#### 1. **Explicit Instructions for Both Parties**
```
Extract action items for BOTH parties:
- Sales Rep tasks: Things the rep/your team needs to do
- Prospect/Customer tasks: Things the customer agreed to do
```

#### 2. **Common Action Item Examples**
Added specific categories to look for:
- Send information (proposals, pricing, case studies)
- Schedule meetings (demos, follow-ups, stakeholder calls)
- Internal tasks (check with team, get approval)
- Customer tasks (review materials, provide info, make decisions)
- Technical items (integrations, access, configuration)

#### 3. **Implicit Action Recognition**
Taught Claude to recognize different types of commitments:
- **Explicit**: "I'll send you the proposal by Friday"
- **Implicit**: "We need to review the contract"
- **Commitments**: "We'll get back to you with those numbers"
- **Questions**: "Let me check with the team and circle back"
- **Next steps**: "Let's schedule a follow-up for next week"

#### 4. **Smart Date Parsing**
Enhanced deadline parsing with common phrases:
- "tomorrow" = 1 day from meeting
- "next week" = 7 days from meeting
- "end of week" = nearest Friday
- "by Friday" = nearest Friday
- "in 2 days" = 2 days from meeting

#### 5. **Confidence Scoring Guidelines**
Clear guidance on confidence levels:
- **0.9-1.0**: Explicit commitment ("I will...")
- **0.7-0.9**: Strong indication ("We should...")
- **0.5-0.7**: Implied action ("That would be helpful...")
- **<0.5**: Unclear or speculative

#### 6. **Better Examples**
Updated JSON examples to show:
- Multiple action items (4 examples instead of 1)
- Mix of rep and customer tasks
- Different categories and priorities
- Various confidence levels

#### 7. **Thoroughness Instructions**
Added explicit guidance:
```
- Be thorough - extract ALL action items (aim for at least 3-5 per sales call)
- Include BOTH sales rep tasks AND customer/prospect tasks
- Don't be conservative - if something was discussed as a next step, include it
```

## Deployment

**Edge Function Updated**: ✅ Deployed to production
- File: `/supabase/functions/fathom-sync/aiAnalysis.ts`
- Deployment: Successfully deployed to Supabase

## Testing Instructions

### Option 1: Re-analyze Existing Meetings

1. **Run SQL script** to clear AI metrics:
   ```bash
   # Open Supabase SQL Editor
   # Run: REANALYZE_TRANSCRIPTS.sql
   ```

2. **Trigger sync**:
   - Go to http://localhost:5173/integrations
   - Click "Test Sync"
   - Wait 2-5 minutes

3. **Verify results**:
   ```sql
   SELECT
     m.title,
     COUNT(mai.id) as action_items,
     STRING_AGG(mai.assigned_to, ', ') as assignees
   FROM meetings m
   LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
   WHERE m.meeting_start >= NOW() - INTERVAL '7 days'
     AND mai.ai_generated = true
   GROUP BY m.id, m.title
   ORDER BY m.meeting_start DESC;
   ```

### Option 2: Test with New Meetings

Just sync new meetings and check the action items appear in the sidebar.

## Expected Results

### Before (Old Prompt)
- ❌ 0 action items extracted
- ❌ Only caught explicit "I will..." statements
- ❌ Missed customer commitments entirely

### After (New Prompt)
- ✅ 3-8 action items per sales call
- ✅ Both rep and customer action items
- ✅ Mix of explicit and implicit commitments
- ✅ Proper categorization (proposal, demo, follow_up, etc.)
- ✅ Realistic confidence scores (0.5-1.0 range)
- ✅ Parsed deadlines from natural language

## UI Integration

Action items now appear in the **right sidebar** of the Meeting Detail page:
- Compact cards with title and assignee
- AI confidence percentage badge
- Priority and category badges
- Timestamp jump button to video
- Scrollable with max 500px height

## Next Steps

If action items still aren't being extracted after re-analysis:
1. Check Edge Function logs for errors
2. Verify transcripts are properly formatted (not `[object Object]`)
3. Increase `max_tokens` in AI request (currently 4096)
4. Adjust confidence threshold if needed

## Success Metrics

**Target**: 80% of sales calls should have 3+ action items
**Current Status**: After deployment, awaiting test results

---

**Status**: ✅ Deployed | ⏳ Awaiting Re-analysis
