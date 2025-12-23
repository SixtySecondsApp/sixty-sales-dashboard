#!/bin/bash

# Test AI Analysis Edge Function
# This script calls the analyze-action-item edge function

set -e

PROJECT_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

echo "=========================================="
echo "🧪 Testing AI Analysis Edge Function"
echo "=========================================="
echo ""

# Get action item ID from database
echo "📋 Finding action item to analyze..."
ACTION_ITEM_ID=$(supabase db execute --project-ref ewtuefzeogytgmsnkpmb "SELECT id FROM meeting_action_items WHERE ai_analyzed_at IS NULL LIMIT 1;" 2>/dev/null | grep -oE '[0-9a-f-]{36}' | head -1)

if [ -z "$ACTION_ITEM_ID" ]; then
    echo "❌ No unanalyzed action items found"
    echo ""
    echo "Create a test action item first:"
    echo "INSERT INTO meeting_action_items (meeting_id, title, assignee_email, priority, deadline_at)"
    echo "SELECT id, 'Send pricing proposal to client', 'test@example.com', 'high', NOW() + INTERVAL '3 days'"
    echo "FROM meetings LIMIT 1;"
    exit 1
fi

echo "✅ Found action item: $ACTION_ITEM_ID"
echo ""

# Get service role key from secrets
echo "🔑 Getting service role key..."
SERVICE_ROLE_KEY=$(supabase secrets list --project-ref ewtuefzeogytgmsnkpmb 2>&1 | grep "SERVICE_ROLE_KEY" | awk '{print $NF}')

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Could not retrieve service role key"
    echo "Using key from environment or .env file..."
    # Try to get from .env
    if [ -f ".env" ]; then
        SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    fi
fi

echo ""
echo "📡 Calling AI Analysis Edge Function..."
echo "URL: $PROJECT_URL/functions/v1/analyze-action-item"
echo "Action Item: $ACTION_ITEM_ID"
echo ""

# Call edge function
RESPONSE=$(curl -s -X POST "$PROJECT_URL/functions/v1/analyze-action-item" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action_item_id\": \"$ACTION_ITEM_ID\"}")

echo "📊 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if analysis was successful
if echo "$RESPONSE" | grep -q "task_type"; then
    echo "✅ AI Analysis Successful!"
    echo ""
    echo "Checking database..."
    supabase db execute --project-ref ewtuefzeogytgmsnkpmb \
      "SELECT ai_task_type, ai_confidence_score, LEFT(ai_reasoning, 100) as reasoning_preview FROM meeting_action_items WHERE id = '$ACTION_ITEM_ID';" 2>/dev/null || true
else
    echo "❌ AI Analysis Failed"
    echo "Check edge function logs:"
    echo "https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions"
fi

echo ""
echo "=========================================="
