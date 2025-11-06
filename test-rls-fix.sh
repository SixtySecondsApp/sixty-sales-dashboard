#!/bin/bash
# Test RLS fix by attempting to query with anon key after re-enabling

source .env 2>/dev/null || true

echo "🧪 Testing RLS Configuration"
echo ""

echo "1️⃣ Current RLS status (before re-enable):"
echo "   Checking if we can query suggestions with anon key..."
SUGGESTIONS_COUNT=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count')
echo "   Suggestions visible with anon key: $SUGGESTIONS_COUNT"

echo ""
echo "   Checking if we can query tasks with anon key..."
TASKS_COUNT=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count')
echo "   Tasks visible with anon key: $TASKS_COUNT"

echo ""
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: Now run FINAL_RLS_FIX.sql in Supabase SQL Editor"
echo ""
echo "After running the SQL script, run this test again to verify."
echo ""
echo "Expected results after fix:"
echo "  - Suggestions should still be visible (SELECT policy allows user to see own data)"
echo "  - Tasks should still be visible (SELECT policy allows user to see own data)"
echo "  - Edge Function should still be able to INSERT (WITH CHECK true policy)"
