#!/bin/bash

# Monitor new development branch creation
# Branch ID: 17b178b9-bb9b-4ccd-a125-5e49398bb989

echo "🔍 Checking development-v2 branch status..."
echo ""

while true; do
  STATUS=$(supabase branches list --experimental 2>/dev/null | grep "17b178b9-bb9b-4ccd-a125-5e49398bb989" | awk '{print $10}')

  echo "$(date '+%H:%M:%S') - Status: $STATUS"

  if [ "$STATUS" = "ACTIVE" ]; then
    echo ""
    echo "✅ Branch is ACTIVE!"
    echo ""
    echo "Getting branch connection details..."
    supabase branches get 17b178b9-bb9b-4ccd-a125-5e49398bb989 \
      --project-ref ewtuefzeogytgmsnkpmb \
      --output json \
      --experimental | jq '.'
    break
  elif [ "$STATUS" = "MIGRATIONS_FAILED" ]; then
    echo ""
    echo "⚠️  Branch created but shows MIGRATIONS_FAILED (expected due to production issue)"
    echo "This is OK - the branch is usable. Getting connection details..."
    echo ""
    supabase branches get 17b178b9-bb9b-4ccd-a125-5e49398bb989 \
      --project-ref ewtuefzeogytgmsnkpmb \
      --output json \
      --experimental | jq '.'
    break
  elif [ "$STATUS" = "CREATING_PROJECT" ]; then
    echo "   Still creating project... (this can take 2-5 minutes)"
  else
    echo "   Unknown status: $STATUS"
  fi

  sleep 10
done
