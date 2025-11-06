#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🧪 Testing AI Edge Function with simple test data..."
echo ""

# Test with clean, simple data
curl -s -X POST "${SUPABASE_URL}/functions/v1/condense-meeting-summary" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "We discussed the Q4 roadmap and agreed on three main priorities: improving the mobile app performance, launching the new enterprise features, and expanding our customer support team. The team raised concerns about technical debt that needs to be addressed. Next steps include: Sarah will draft the technical architecture document by Friday, John will reach out to potential enterprise customers for beta testing, and we will schedule a follow-up meeting next week to review progress.",
    "meetingTitle": "Q4 Planning Meeting"
  }' | jq '.'
