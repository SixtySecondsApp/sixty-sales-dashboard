#!/bin/bash

# Batch Re-fetch Action Items from Fathom
# This script calls the fathom-webhook for all meetings with 0 action items

# SETUP: Replace with your actual Supabase anon key from .env
SUPABASE_ANON_KEY="YOUR_ANON_KEY_HERE"
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Starting batch re-fetch of Fathom action items..."
echo ""

# Check if SUPABASE_ANON_KEY is set
if [ "$SUPABASE_ANON_KEY" = "YOUR_ANON_KEY_HERE" ]; then
    echo -e "${RED}❌ Error: Please replace YOUR_ANON_KEY_HERE with your actual Supabase anon key${NC}"
    echo "Find it in your .env file: VITE_SUPABASE_ANON_KEY"
    exit 1
fi

# Array of Fathom recording IDs - YOU NEED TO FILL THIS FROM THE SQL QUERY
# Run batch-refetch-commands.sql to get the recording IDs
RECORDING_IDS=(
    # Add your recording IDs here, one per line
    # Example:
    # "rec_abc123def456"
    # "rec_xyz789ghi012"
)

if [ ${#RECORDING_IDS[@]} -eq 0 ]; then
    echo -e "${RED}❌ Error: No recording IDs found${NC}"
    echo "Please run batch-refetch-commands.sql in Supabase SQL Editor"
    echo "Copy the fathom_recording_id values and paste them into this script"
    exit 1
fi

echo "📋 Found ${#RECORDING_IDS[@]} meetings to process"
echo ""

# Counter for success/failure
SUCCESS_COUNT=0
FAIL_COUNT=0

# Process each recording ID
for i in "${!RECORDING_IDS[@]}"; do
    RECORDING_ID="${RECORDING_IDS[$i]}"
    MEETING_NUM=$((i + 1))

    echo -e "${YELLOW}[$MEETING_NUM/${#RECORDING_IDS[@]}]${NC} Processing: $RECORDING_ID"

    # Call the webhook
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SUPABASE_URL" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"recording_id\": \"$RECORDING_ID\", \"force_resync\": true}")

    # Extract status code (last line)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

    # Check if successful (200-299)
    if [[ $HTTP_CODE -ge 200 && $HTTP_CODE -lt 300 ]]; then
        echo -e "${GREEN}✅ Success${NC} (HTTP $HTTP_CODE)"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}❌ Failed${NC} (HTTP $HTTP_CODE)"
        echo "Response: $(echo "$RESPONSE" | head -n-1)"
        ((FAIL_COUNT++))
    fi

    echo ""

    # Small delay to avoid rate limiting
    sleep 1
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total Processed: ${#RECORDING_IDS[@]}"
echo -e "${GREEN}Successful: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Action items have been re-fetched!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run the verification query in Supabase SQL Editor:"
    echo "   (See refetch-all-action-items.sql - Step 3)"
    echo "2. Visit meeting detail pages to see action items"
    echo "3. Click 'Add to Tasks' for items you want to track"
fi

echo ""
echo "🎉 Batch re-fetch complete!"
