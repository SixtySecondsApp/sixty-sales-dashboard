#!/bin/bash

# Test script for Meeting Summary Condensing feature
# Tests the condense-meeting-summary Edge Function

set -e

echo "🧪 Testing Meeting Summary Condensing Feature"
echo "=============================================="
echo ""

# Configuration
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  Environment variables not set. Please provide them manually:"
  read -p "Enter Supabase URL: " SUPABASE_URL
  read -p "Enter Supabase Anon Key: " SUPABASE_ANON_KEY
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/condense-meeting-summary"

# Test 1: Simple meeting summary
echo "Test 1: Simple Meeting Summary"
echo "-------------------------------"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "We discussed the Q4 pricing strategy for our enterprise tier. The customer expressed concerns about implementation timeline and security. We agreed to send a proposal by Friday and schedule a technical demo next week.",
    "meetingTitle": "Enterprise Pricing Discussion"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Verify response
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ Test 1 PASSED"
  MEETING_ABOUT=$(echo "$RESPONSE" | jq -r '.meeting_about')
  NEXT_STEPS=$(echo "$RESPONSE" | jq -r '.next_steps')
  echo "   Meeting About: $MEETING_ABOUT"
  echo "   Next Steps: $NEXT_STEPS"
else
  echo "❌ Test 1 FAILED"
  echo "   Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
fi
echo ""

# Test 2: Long complex summary
echo "Test 2: Long Complex Summary"
echo "-----------------------------"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "## Meeting Overview\n\nWe had an extensive discussion about the product roadmap for Q1 2025. The team reviewed the current sprint progress and identified several blockers that need immediate attention. Key topics included:\n\n- API performance optimization\n- Database scaling strategy\n- New feature prioritization\n- Security audit findings\n- Customer feedback integration\n\n## Action Items\n\n1. Engineering team to implement caching layer by next Friday\n2. Schedule security review meeting with compliance team\n3. Product manager to create prioritization matrix for new features\n4. Follow up with customer success on top 5 feature requests\n5. Schedule technical architecture review for scaling strategy next month\n\n## Next Steps\n\nWe agreed to reconvene next Tuesday to review progress on the action items and make final decisions on Q1 priorities.",
    "meetingTitle": "Q1 2025 Product Roadmap Planning"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ Test 2 PASSED"
  MEETING_ABOUT=$(echo "$RESPONSE" | jq -r '.meeting_about')
  NEXT_STEPS=$(echo "$RESPONSE" | jq -r '.next_steps')
  echo "   Meeting About: $MEETING_ABOUT"
  echo "   Next Steps: $NEXT_STEPS"

  # Verify word count
  ABOUT_WORDS=$(echo "$MEETING_ABOUT" | wc -w | xargs)
  STEPS_WORDS=$(echo "$NEXT_STEPS" | wc -w | xargs)

  if [ "$ABOUT_WORDS" -le 15 ]; then
    echo "   ✅ Meeting About word count: $ABOUT_WORDS/15"
  else
    echo "   ⚠️  Meeting About word count exceeds limit: $ABOUT_WORDS/15"
  fi

  if [ "$STEPS_WORDS" -le 15 ]; then
    echo "   ✅ Next Steps word count: $STEPS_WORDS/15"
  else
    echo "   ⚠️  Next Steps word count exceeds limit: $STEPS_WORDS/15"
  fi
else
  echo "❌ Test 2 FAILED"
  echo "   Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
fi
echo ""

# Test 3: Empty summary (should fail gracefully)
echo "Test 3: Empty Summary (Error Handling)"
echo "---------------------------------------"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "",
    "meetingTitle": "Empty Meeting"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo "✅ Test 3 PASSED (Correctly rejected empty summary)"
else
  echo "⚠️  Test 3: Expected failure for empty summary"
fi
echo ""

# Test 4: Sales call scenario
echo "Test 4: Realistic Sales Call"
echo "-----------------------------"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Great discovery call with Acme Corp. They are looking for a solution to streamline their sales workflow. Current pain points: manual data entry taking 2 hours daily, no visibility into pipeline health, team scattered across multiple tools. They have budget approved for Q1 and want to move fast. Competitive pressure from their board to show efficiency gains. Perfect fit for our platform. They want to see a demo next week focusing on automation and reporting capabilities. Decision maker is Sarah Johnson (VP Sales) who will bring in 2 other stakeholders. Timeline: Demo next week, trial by end of month, contract target for mid-January.",
    "meetingTitle": "Acme Corp - Discovery Call"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ Test 4 PASSED"
  MEETING_ABOUT=$(echo "$RESPONSE" | jq -r '.meeting_about')
  NEXT_STEPS=$(echo "$RESPONSE" | jq -r '.next_steps')
  echo "   Meeting About: $MEETING_ABOUT"
  echo "   Next Steps: $NEXT_STEPS"
else
  echo "❌ Test 4 FAILED"
  echo "   Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
fi
echo ""

# Summary
echo "=============================================="
echo "🎉 Testing Complete!"
echo ""
echo "If all tests passed, the feature is working correctly."
echo "You can now deploy to production."
echo ""
echo "Next steps:"
echo "1. Deploy database migration: supabase db push"
echo "2. Deploy Edge Functions: supabase functions deploy condense-meeting-summary"
echo "3. Deploy updated fathom-sync: supabase functions deploy fathom-sync"
echo "4. Deploy frontend changes"
echo "5. Test with real meeting data"
