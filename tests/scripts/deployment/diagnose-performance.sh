#!/bin/bash
# Diagnose performance issues

source .env 2>/dev/null || true

echo "🔍 Performance Diagnostic Report"
echo ""

echo "1️⃣ Check RLS status on main tables:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/rpc/pg_tables_with_rls" \
  -X POST \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo "RPC not available, using direct query"

echo ""
echo "2️⃣ Test query speed - Simple task query:"
time curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=id,title&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" > /dev/null

echo ""
echo "3️⃣ Test query speed - Complex task query with joins:"
time curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=*,assignee:profiles!assigned_to(id,first_name),company:companies(id,name)&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" > /dev/null

echo ""
echo "4️⃣ Test query speed - Meetings query:"
time curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,next_actions_count&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" > /dev/null

echo ""
echo "5️⃣ Count policies on tasks table:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/pg_policies?tablename=eq.tasks&select=count" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "6️⃣ Check for missing indexes:"
echo "This would require SQL access - checking common issues..."

echo ""
echo "7️⃣ Network latency test:"
time curl -s "${VITE_SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" > /dev/null

echo ""
echo "✅ Diagnostic complete"
