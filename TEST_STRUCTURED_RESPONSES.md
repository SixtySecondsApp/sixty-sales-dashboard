# Testing Structured Responses in Browser

## Prerequisites
1. **Login** to the application at http://localhost:5173/copilot
2. **Open Browser Console** (F12 or Cmd+Option+I) to see debug logs

## Test Steps

### 1. Test Pipeline Response
**Query**: "Show me deals that need attention"

**Expected Result**:
- ✅ Structured UI with metrics cards (Total Value, At Risk, Closing This Week, Avg Health)
- ✅ Critical deals section with red indicators
- ✅ High priority deals section with amber indicators
- ✅ Action buttons at the bottom
- ❌ NOT plain markdown text

**Console Logs to Check**:
```
📥 API Response: { hasStructuredResponse: true, structuredResponseType: 'pipeline', ... }
💾 Storing structured response: { type: 'pipeline', ... }
📊 Rendering structured response: pipeline
```

### 2. Test Another Pipeline Query
**Query**: "What should I prioritize today?"

**Expected Result**:
- Same structured pipeline UI as above
- Different deals/metrics based on your data

### 3. Test Non-Pipeline Query (Fallback)
**Query**: "Hello, how are you?"

**Expected Result**:
- ✅ Plain text response (legacy format)
- ❌ No structured response (this is correct - not a pipeline query)

## What to Look For

### ✅ Success Indicators
1. **Metrics Cards** - 4 cards showing:
   - Total Value (currency formatted)
   - At Risk (red number)
   - Closing This Week (amber number)
   - Avg Health (green number)

2. **Deal Cards** - Glassmorphism styled cards with:
   - Deal name
   - Value, stage, probability
   - Health score
   - Close date (if available)
   - Color-coded left border (red/amber/blue)

3. **Action Buttons** - Blue primary buttons like:
   - "Schedule Follow-up"
   - "View All Deals"

4. **Styling**:
   - Dark glassmorphism background
   - Smooth animations
   - Proper spacing and layout

### ❌ Failure Indicators
1. **Plain text/markdown** instead of structured UI
2. **No metrics cards** visible
3. **Console errors** about missing components
4. **Console shows** `hasStructuredResponse: false`

## Debugging

### If Structured Response Doesn't Show

1. **Check Console Logs**:
   - Look for `📥 API Response:` log
   - Check if `hasStructuredResponse: true`
   - Check if `structuredResponseType: 'pipeline'`

2. **Check Network Tab**:
   - Find the request to `/functions/v1/api-copilot/chat`
   - Check the response payload
   - Look for `structuredResponse` field

3. **Check Backend Logs**:
   - Go to Supabase Dashboard → Functions → api-copilot → Logs
   - Look for `[detectAndStructureResponse]` logs
   - Look for `[structurePipelineResponse]` logs
   - Check for errors

4. **Verify Intent Detection**:
   - The query must include: "pipeline", "deal", "deals", "what should i prioritize", "needs attention", etc.
   - Check backend logs to see if intent was detected

5. **Verify Data**:
   - Make sure you have active deals in the database
   - Check that deals have `status = 'active'`
   - Check that deals have `owner_id` matching your user ID

## Expected Console Output

### Successful Structured Response
```
📥 API Response: {
  hasStructuredResponse: true,
  structuredResponseType: 'pipeline',
  hasContent: true,
  hasRecommendations: false
}
💾 Storing structured response: {
  type: 'pipeline',
  summary: "I've analyzed your pipeline...",
  data: { ... },
  actions: [ ... ]
}
📊 Rendering structured response: pipeline { ... }
```

### Fallback to Text Response
```
📥 API Response: {
  hasStructuredResponse: false,
  structuredResponseType: undefined,
  hasContent: true,
  hasRecommendations: false
}
```

## Next Steps After Testing

1. **If it works**: Great! The integration is complete.
2. **If it doesn't work**: Check the debugging steps above and verify:
   - Backend is deployed with latest code
   - Intent detection is working
   - Database queries are returning data
   - Frontend components are rendering correctly

## Test Checklist

- [ ] Login to application
- [ ] Open browser console
- [ ] Navigate to /copilot
- [ ] Send query: "Show me deals that need attention"
- [ ] Check console for debug logs
- [ ] Verify structured UI appears (not plain text)
- [ ] Verify metrics cards are visible
- [ ] Verify deal cards are visible
- [ ] Verify action buttons are visible
- [ ] Test another pipeline query
- [ ] Test non-pipeline query (should show plain text)

