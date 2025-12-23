# Edge Function Debugging Guide

## Current Situation

- ✅ ANTHROPIC_API_KEY is configured in Supabase
- ✅ Edge Function executes without errors (HTTP 200)
- ✅ Meetings have full transcripts (12K+ characters)
- ❌ Claude returns empty array `[]` for all meetings

## What to Check in Supabase Dashboard

### 1. Access Edge Function Logs

```
Supabase Dashboard → Edge Functions → suggest-next-actions → Logs
```

### 2. Look for These Critical Log Messages

When you run `./test-ai-one-meeting.sh`, you should see these logs:

#### ✅ Expected Logs (Good)
```
[suggest-next-actions] Processing meeting 7baadf93-d836-4bbd-a50b-4df04bb52f9c
[generateSuggestionsWithClaude] Calling Claude API
[generateSuggestionsWithClaude] AI response length: 1234
[storeSuggestions] Mapping task_category "email" to action_type "email"
[autoCreateTasksFromSuggestions] Created task: Send follow-up email
```

#### ❌ Problem Indicators

**If you see:**
```
[generateSuggestionsWithClaude] AI response length: 2
```
→ Claude is returning `[]` (empty array)

**If you see:**
```
[generateSuggestionsWithClaude] Failed to parse AI response: ...
[generateSuggestionsWithClaude] Raw response: ...
```
→ Claude returned invalid JSON

**If you see:**
```
[generateSuggestionsWithClaude] Claude API error: ...
```
→ API call failed (but this should return HTTP 500, not 200)

**If you DON'T see:**
```
[generateSuggestionsWithClaude] Calling Claude API
```
→ The function exits early (but we know it's reaching this point)

### 3. Check for Silent Failures

The issue might be at **line 486-490** in the Edge Function:

```typescript
try {
  const suggestions = JSON.parse(aiResponse)
  return Array.isArray(suggestions) ? suggestions : []
} catch (parseError) {
  console.error('[generateSuggestionsWithClaude] Failed to parse AI response:', parseError)
  console.error('[generateSuggestionsWithClaude] Raw response:', aiResponse.substring(0, 200))
  return []
}
```

**If parsing fails**, you should see the error logs. **If you DON'T see them**, then Claude IS returning valid JSON, but it's an empty array `[]`.

## Possible Root Causes

### A. Claude Model Configuration Issue

Check the `CLAUDE_MODEL` environment variable:

**Current default** (line 442):
```typescript
const model = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001'
```

**Possible issues:**
1. Model name is incorrect or deprecated
2. Model doesn't have access to your API key
3. Model version changed

**How to fix:**
- Try updating to latest model: `claude-3-5-haiku-20241022`
- Or use: `claude-3-5-sonnet-20241022`

### B. Claude API Rate Limiting or Quota

**Symptoms:**
- Claude returns empty results
- No error messages
- API call succeeds (HTTP 200)

**How to check:**
- Log into Anthropic Console: https://console.anthropic.com
- Check API usage and rate limits
- Verify account status

### C. Transcript Format Issue

The AI might not be finding actionable items because:
1. Transcript format is unexpected
2. Speaker names are confusing the AI
3. Content doesn't contain clear action items

**Sample transcript we're testing:**
```
Angela Hale: I was having some camera audio permission stuff with Google Meet.
Andrew Bryce: I'm consistently...
Angela Hale: I'm consistently five minutes behind.
```

This is mostly casual conversation without clear action items like:
- "Send me the proposal by Friday"
- "Schedule a follow-up next week"
- "I'll review the pricing and get back to you"

### D. AI Prompt Too Strict

The current prompt (lines 352-392) asks for:
- 2-4 specific, actionable next steps
- Clear task categories
- High confidence scores
- Reasoning for each action

**If the transcript doesn't contain CLEAR action items**, Claude might legitimately return `[]`.

## Recommended Actions

### Action 1: Add More Detailed Logging

Modify the Edge Function to log Claude's raw response:

**In `supabase/functions/suggest-next-actions/index.ts` at line 471:**

```typescript
const responseData = await response.json()
let aiResponse = responseData.content[0]?.text || '[]'

console.log('[generateSuggestionsWithClaude] AI response length:', aiResponse.length)
console.log('[generateSuggestionsWithClaude] Raw AI response:', aiResponse) // ADD THIS LINE
```

Then redeploy:
```bash
supabase functions deploy suggest-next-actions
```

### Action 2: Test with a Meeting That Has Clear Action Items

Look for a meeting transcript that contains phrases like:
- "Send me..."
- "Follow up on..."
- "Schedule..."
- "I need..."
- "Can you..."
- "Let's discuss..."

**Run:**
```bash
# First, find a meeting with clearer action items
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq -r '.[] | "\(.title): \(.transcript_text | length) chars"'

# Then manually review transcripts to find one with clear actions
```

### Action 3: Try a Different Claude Model

Update the Edge Function environment variable:

**In Supabase Dashboard:**
```
Project Settings → Edge Functions → Secrets
```

Add or update:
```
CLAUDE_MODEL = claude-3-5-sonnet-20241022
```

This uses the more powerful Sonnet model instead of Haiku.

### Action 4: Simplify the AI Prompt

If the current prompt is too strict, try a simpler version:

**Modify line 352 in the Edge Function:**

```typescript
const systemPrompt = `You are a sales AI assistant. Analyze this meeting transcript and suggest 1-3 follow-up tasks.

For each task, provide:
1. task_category: call, email, meeting, follow_up, proposal, demo, or general
2. title: What to do
3. reasoning: Why this matters
4. urgency: low, medium, or high
5. recommended_deadline: ISO 8601 date
6. confidence_score: 0.0 to 1.0

Return ONLY a JSON array. If no clear actions, return an empty array [].`
```

This is less demanding and might return results for more meetings.

## Testing After Changes

### Test Script
```bash
# After making changes, test one meeting
./test-ai-one-meeting.sh

# If successful, test all meetings
./trigger-ai-analysis.sh

# Check results
./check-meeting-details.sh
```

### Expected Success Output
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "title": "Send follow-up email",
      "action_type": "email",
      "urgency": "medium"
    }
  ],
  "tasks": [
    {
      "id": "uuid",
      "title": "Send follow-up email",
      "status": "pending",
      "source": "ai_suggestion"
    }
  ],
  "count": 1,
  "activity_type": "meeting"
}
```

## Quick Diagnosis Checklist

Run through this checklist:

- [ ] Check Edge Function logs for `[generateSuggestionsWithClaude] AI response length:`
- [ ] Verify the response length (should be >100 if Claude generated suggestions)
- [ ] Check if `CLAUDE_MODEL` is set correctly
- [ ] Verify Anthropic Console for API usage/errors
- [ ] Test with a meeting that has clearer action items
- [ ] Try updating to Claude 3.5 Sonnet model
- [ ] Add more detailed logging to see raw AI response
- [ ] Consider simplifying the AI prompt

## Next Steps

1. **Immediate**: Check the Edge Function logs right now while running a test
2. **Short-term**: Try different Claude model or simplify prompt
3. **Long-term**: Enhance logging for better debugging

Run this to generate fresh logs:
```bash
./test-ai-one-meeting.sh
```

Then immediately check the logs in Supabase Dashboard.
