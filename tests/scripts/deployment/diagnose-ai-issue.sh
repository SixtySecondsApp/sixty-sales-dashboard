#!/bin/bash
# Comprehensive AI Analysis Diagnostic Script

source .env 2>/dev/null || true

echo "🔍 AI Analysis Diagnostic Report"
echo "=================================="
echo ""

echo "1️⃣ Environment Check"
echo "-------------------"
echo "Supabase URL: ${VITE_SUPABASE_URL:0:30}..."
echo "Anon Key: ${VITE_SUPABASE_ANON_KEY:0:20}..."
echo ""

echo "2️⃣ Meeting Data Quality"
echo "----------------------"
MEETING=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text,owner_user_id,company_id,primary_contact_id&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[0]')

MEETING_ID=$(echo "$MEETING" | jq -r '.id')
MEETING_TITLE=$(echo "$MEETING" | jq -r '.title')
TRANSCRIPT_LENGTH=$(echo "$MEETING" | jq -r '.transcript_text | length')
HAS_OWNER=$(echo "$MEETING" | jq -r '.owner_user_id')
HAS_COMPANY=$(echo "$MEETING" | jq -r '.company_id')
HAS_CONTACT=$(echo "$MEETING" | jq -r '.primary_contact_id')

echo "Meeting: $MEETING_TITLE ($MEETING_ID)"
echo "Transcript length: $TRANSCRIPT_LENGTH characters"
echo "Has owner: $([ "$HAS_OWNER" != "null" ] && echo "✅ Yes" || echo "❌ No")"
echo "Has company: $([ "$HAS_COMPANY" != "null" ] && echo "✅ Yes" || echo "❌ No")"
echo "Has contact: $([ "$HAS_CONTACT" != "null" ] && echo "✅ Yes" || echo "❌ No")"
echo ""

echo "Sample transcript (first 500 chars):"
echo "---"
echo "$MEETING" | jq -r '.transcript_text' | head -c 500
echo "..."
echo "---"
echo ""

echo "3️⃣ Edge Function Test"
echo "--------------------"
echo "Calling suggest-next-actions with forceRegenerate=true..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${VITE_SUPABASE_URL}/functions/v1/suggest-next-actions" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"activityId\": \"$MEETING_ID\",
    \"activityType\": \"meeting\",
    \"forceRegenerate\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

SUGGESTION_COUNT=$(echo "$BODY" | jq -r '.count // 0')
TASK_COUNT=$(echo "$BODY" | jq -r '.tasks | length // 0')

echo "Suggestions created: $SUGGESTION_COUNT"
echo "Tasks created: $TASK_COUNT"
echo ""

echo "4️⃣ Database Check"
echo "----------------"
echo "Next action suggestions in database:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?activity_id=eq.$MEETING_ID&select=id,title,action_type,status,reasoning,confidence_score" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "Tasks in database:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.$MEETING_ID&select=id,title,task_type,status,source" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "5️⃣ Potential Issues"
echo "------------------"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Edge Function returned HTTP $HTTP_CODE (expected 200)"
fi

if [ "$SUGGESTION_COUNT" -eq 0 ]; then
  echo "❌ No suggestions were created by Claude AI"
  echo ""
  echo "Possible causes:"
  echo "  1. ANTHROPIC_API_KEY not set in Supabase Edge Functions secrets"
  echo "  2. Claude API is returning empty results"
  echo "  3. Transcript doesn't contain clear action items"
  echo "  4. AI prompt is too restrictive"
  echo ""
  echo "Next steps:"
  echo "  → Check Supabase Dashboard → Project Settings → Edge Functions → Secrets"
  echo "  → Verify ANTHROPIC_API_KEY is set"
  echo "  → Check Edge Function logs for detailed error messages"
fi

if [ "$TASK_COUNT" -eq 0 ] && [ "$SUGGESTION_COUNT" -gt 0 ]; then
  echo "⚠️  Suggestions created but no tasks generated"
  echo ""
  echo "Possible causes:"
  echo "  1. Task creation logic has an issue"
  echo "  2. owner_user_id is missing or invalid"
fi

if [ "$TRANSCRIPT_LENGTH" -lt 100 ]; then
  echo "⚠️  Transcript is very short ($TRANSCRIPT_LENGTH characters)"
  echo "   This might not provide enough context for AI analysis"
fi

echo ""
echo "6️⃣ Recommendations"
echo "-----------------"
echo "1. Check Supabase Dashboard for Edge Function logs:"
echo "   Dashboard → Edge Functions → suggest-next-actions → Logs"
echo ""
echo "2. Look for these log messages:"
echo "   - [suggest-next-actions] Processing meeting ..."
echo "   - [generateSuggestionsWithClaude] Calling Claude API"
echo "   - [generateSuggestionsWithClaude] AI response length: ..."
echo "   - [autoCreateTasksFromSuggestions] Created task: ..."
echo ""
echo "3. If ANTHROPIC_API_KEY is missing:"
echo "   Dashboard → Project Settings → Edge Functions → Add secret"
echo "   Name: ANTHROPIC_API_KEY"
echo "   Value: sk-ant-..."
echo ""
echo "4. Test with a different meeting that has clearer action items"
echo ""

echo "=================================="
echo "✅ Diagnostic complete!"
