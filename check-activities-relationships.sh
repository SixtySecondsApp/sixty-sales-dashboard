#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "📊 Checking activities with relationship IDs for navigation..."
echo ""

curl -s -X GET "${SUPABASE_URL}/rest/v1/activities?select=id,type,client_name,details,company_id,contact_id,meeting_id&type=eq.meeting&limit=5&order=created_at.desc" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[] | {type, client: .client_name, company_id, contact_id, meeting_id, details: (.details | if type == "string" and (. | length) > 100 then .[0:100] + "..." else . end)}'
