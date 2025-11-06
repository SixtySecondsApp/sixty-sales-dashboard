#!/bin/bash
source .env 2>/dev/null || true

curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.66a9e65f-464d-4a95-9144-ef4f8f794495&select=id,company,company_id&limit=1" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" | jq '.'
