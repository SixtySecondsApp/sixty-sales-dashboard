#!/bin/bash

# Manual trigger for AI analysis on the test action item
# Replace ACTION_ITEM_ID with the ID from your test (084a60d5-bb72-48eb-99df-cbc13d455966)

ACTION_ITEM_ID="084a60d5-bb72-48eb-99df-cbc13d455966"
PROJECT_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

# Get service role key from environment
if [ -f ".env" ]; then
    SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env file"
    echo "Add it to .env file or set it manually below"
    exit 1
fi

echo "=========================================="
echo "🤖 Triggering AI Analysis"
echo "=========================================="
echo ""
echo "Action Item ID: $ACTION_ITEM_ID"
echo "Edge Function: $PROJECT_URL/functions/v1/analyze-action-item"
echo ""

# Call the edge function
curl -X POST "$PROJECT_URL/functions/v1/analyze-action-item" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action_item_id\": \"$ACTION_ITEM_ID\"}" \
  | jq '.'

echo ""
echo "=========================================="
echo ""
echo "Now run CHECK_AI_ANALYSIS.sql to see the results"
