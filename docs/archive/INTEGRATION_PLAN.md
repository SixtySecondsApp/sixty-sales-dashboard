# Action Items → AI Suggestions Integration Plan

## Overview
Replace the old "Extract Action Items" functionality with the superior AI Next-Actions system while maintaining the same UI location in the sidebar.

## Comparison: Old vs New

### Old System (`meeting_action_items`)
- ❌ Simple extraction from Fathom API
- ❌ No reasoning or context
- ❌ Basic priority levels
- ❌ Limited AI confidence scoring
- ❌ Manual checkbox completion
- ✅ Timestamp jumping to recording

### New System (`next_action_suggestions`)
- ✅ Claude AI analysis of full transcript
- ✅ Detailed reasoning for each suggestion
- ✅ Urgency levels (high/medium/low)
- ✅ Confidence scores (0-100%)
- ✅ Smart task creation with proper linking
- ✅ Accept/Dismiss workflow
- ✅ Deal/Company/Contact linking
- ✅ Status tracking (pending/accepted/dismissed/completed)
- ✅ User feedback collection

## Migration Strategy

### Phase 1: Data Migration
1. ✅ Keep existing `meeting_action_items` table for historical data
2. ✅ Add view to show old action items as read-only suggestions
3. ✅ No data loss - maintain audit trail

### Phase 2: UI Replacement
1. Replace action items sidebar with NextActionSuggestions component
2. Remove "Extract Action Items" button/functionality
3. Update MeetingDetail.tsx to use AI suggestions in sidebar
4. Remove old action items state management

### Phase 3: Cleanup
1. Deprecate action items extraction Edge Functions
2. Update documentation
3. Remove unused components

## Implementation Steps

### Step 1: Update MeetingDetail Component
**Location**: `src/pages/MeetingDetail.tsx`

**Changes**:
- Replace action items sidebar section (lines 810-920) with NextActionSuggestions
- Remove actionItems state and related functions
- Keep the same sidebar layout and position
- Remove toggleActionItem and handleCreateTask functions for old system

### Step 2: Remove Old Extraction Code
**Files to Clean Up**:
- Remove any "Extract Action Items" buttons
- Remove action items Edge Function calls
- Keep database tables for historical data

### Step 3: Update Tab Layout
**Current**: 5 tabs with "AI Suggestions" tab
**New**: Keep all 5 tabs, but sidebar now shows AI suggestions prominently

## Benefits

1. **Better Quality**: Claude AI provides context-aware suggestions
2. **More Information**: Reasoning, confidence, urgency levels
3. **Smarter Workflow**: Accept creates tasks automatically with proper linking
4. **Better UX**: Single system instead of two competing features
5. **Future-Proof**: AI suggestions can be enhanced further

## Backward Compatibility

- Old action items remain in database as historical record
- Can create read-only view if needed for legacy data
- No breaking changes to existing meetings

## Timeline

- **Now**: Create migration and update UI
- **Testing**: Verify sidebar displays correctly
- **Deployment**: Single deployment with all changes
