#!/bin/bash

# Fix existing activities with overly long details field

echo "🔧 Fixing Existing Activities with Long Details"
echo "=============================================="
echo ""

# Get Supabase credentials
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Could not find Supabase credentials in .env.local"
    exit 1
fi

echo "1️⃣  Finding activities with long details (>500 chars)..."
echo ""

# Get activities with long details
ACTIVITIES=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/activities?select=id,client_name,details,meeting_id&type=eq.meeting&order=created_at.desc" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

# Filter and count long activities
LONG_COUNT=$(echo "$ACTIVITIES" | jq '[.[] | select(.details != null and (.details | length) > 500)] | length')

echo "📊 Found ${LONG_COUNT} activities with details > 500 characters"
echo ""

if [ "$LONG_COUNT" -eq 0 ]; then
    echo "✅ No activities need fixing!"
    exit 0
fi

echo "Sample of activities to fix:"
echo "$ACTIVITIES" | jq -r '[.[] | select(.details != null and (.details | length) > 500)] | .[0:5] | .[] | "   📝 \(.client_name) - \(.details | length) chars"'
echo ""

read -p "Do you want to fix these activities? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Fix cancelled"
    exit 0
fi

echo "🔄 Processing activities..."
echo ""

# Process each activity with long details
FIXED=0
ERROR=0

echo "$ACTIVITIES" | jq -c '.[] | select(.details != null and (.details | length) > 500)' | while read -r activity; do
    ACTIVITY_ID=$(echo "$activity" | jq -r '.id')
    CLIENT_NAME=$(echo "$activity" | jq -r '.client_name')
    DETAILS=$(echo "$activity" | jq -r '.details')

    # Extract and truncate summary
    if echo "$DETAILS" | jq -e . > /dev/null 2>&1; then
        # It's valid JSON, extract markdown_formatted
        EXTRACTED=$(echo "$DETAILS" | jq -r '.markdown_formatted // .text // ""')
    else
        EXTRACTED="$DETAILS"
    fi

    # Remove markdown formatting and clean up
    CLEANED=$(echo "$EXTRACTED" | \
        sed -E 's/\[([^\]]+)\]\([^)]+\)/\1/g' | \
        sed 's/## //g' | \
        sed 's/\*\*//g' | \
        tr '\n' ' ' | \
        sed 's/  */ /g' | \
        sed 's/^ *//;s/ *$//')

    # Truncate to 200 chars
    if [ ${#CLEANED} -gt 200 ]; then
        TRUNCATED="${CLEANED:0:200}..."
    else
        TRUNCATED="$CLEANED"
    fi

    # Update the activity
    UPDATE_RESULT=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/activities?id=eq.${ACTIVITY_ID}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"details\": $(echo "$TRUNCATED" | jq -Rs .)}")

    if [ $? -eq 0 ]; then
        echo "   ✅ Fixed: $CLIENT_NAME"
        ((FIXED++))
    else
        echo "   ❌ Error: $CLIENT_NAME"
        ((ERROR++))
    fi

    # Small delay to avoid rate limiting
    sleep 0.1
done

echo ""
echo "✅ Activity fix completed!"
echo "   Fixed: ${FIXED}"
echo "   Errors: ${ERROR}"
