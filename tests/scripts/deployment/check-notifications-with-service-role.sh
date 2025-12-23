#!/bin/bash
# Check notifications using service role key to bypass RLS

source .env 2>/dev/null || true

echo "🔍 Checking Notifications with Service Role Key"
echo ""

echo "1️⃣ Count with service role (should bypass RLS):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=count" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "2️⃣ All notifications (service role):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=*&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "3️⃣ Count with anon key (RLS applies):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'
