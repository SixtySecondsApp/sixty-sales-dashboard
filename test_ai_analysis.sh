#!/bin/bash

# Test AI Analysis Implementation
# This script triggers a Fathom sync and monitors the logs

echo "🧪 Testing Fathom Sync with AI Analysis"
echo "========================================"
echo ""

# Check if SUPABASE_PROJECT_REF is set
if [ -z "$SUPABASE_PROJECT_REF" ]; then
  SUPABASE_PROJECT_REF="ewtuefzeogytgmsnkpmb"
  echo "Using default project: $SUPABASE_PROJECT_REF"
fi

# Get the function URL
FUNCTION_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/fathom-sync"

echo "Function URL: $FUNCTION_URL"
echo ""
echo "⚠️  Important: Make sure you have set the following secrets in Supabase:"
echo "  - ANTHROPIC_API_KEY"
echo "  - CLAUDE_MODEL (optional, defaults to claude-haiku-4.5)"
echo ""
read -p "Have you set the Claude API key secret? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Please set the ANTHROPIC_API_KEY secret first:"
  echo "   1. Go to https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/functions"
  echo "   2. Click on 'Secrets' tab"
  echo "   3. Add ANTHROPIC_API_KEY with your Anthropic API key"
  echo "   4. (Optional) Add CLAUDE_MODEL with value: claude-haiku-4.5"
  echo "   5. Re-run this test"
  exit 1
fi

echo ""
echo "📋 Triggering Fathom sync (last 7 days)..."
echo ""

# Trigger the sync
# Note: You'll need to replace YOUR_AUTH_TOKEN with a valid Supabase auth token
echo "⚠️  You need to provide an auth token to trigger the sync."
echo "Get your token from the browser console: localStorage.getItem('supabase.auth.token')"
echo ""
read -p "Enter your Supabase auth token: " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Auth token required"
  exit 1
fi

# Call the function
echo ""
echo "🚀 Starting sync..."
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_type": "manual",
    "start_date": "'$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)'",
    "end_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "limit": 5
  }'

echo ""
echo ""
echo "✅ Sync triggered!"
echo ""
echo "📊 Check the logs at:"
echo "https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/logs/edge-functions?type=fathom-sync"
echo ""
echo "🔍 Look for these log messages:"
echo "  ✅ '📄 Auto-fetching transcript for {id} (attempt 1/3)...'"
echo "  ✅ '✅ Transcript fetched: X characters'"
echo "  ✅ '🤖 Running Claude AI analysis on transcript...'"
echo "  ✅ '✅ AI metrics stored: sentiment=X, rep=X%, customer=X%'"
echo "  ✅ '💾 Storing X AI-generated action items...'"
echo ""
echo "💾 Verify in database:"
echo "  Run: SELECT title, transcript_text IS NOT NULL as has_transcript, sentiment_score, talk_time_rep_pct FROM meetings WHERE transcript_text IS NOT NULL LIMIT 5;"
echo ""
