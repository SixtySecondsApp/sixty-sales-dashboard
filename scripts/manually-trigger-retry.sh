#!/bin/bash

# Manual Trigger Script for Transcript Retry Processor
# This script manually triggers the retry processor Edge Function

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔧 Manually Triggering Transcript Retry Processor..."
echo ""

# Get service role key from environment or prompt
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠ SUPABASE_SERVICE_ROLE_KEY not set in environment${NC}"
    echo "Please set it: export SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
    echo "Or enter it when prompted:"
    read -sp "Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
    echo ""
fi

PROJECT_REF="ewtuefzeogytgmsnkpmb"
EDGE_FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/fathom-transcript-retry"

echo "Calling: ${EDGE_FUNCTION_URL}"
echo ""

# Trigger the retry processor
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${EDGE_FUNCTION_URL}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: ${HTTP_CODE}"
echo ""
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Retry processor triggered successfully${NC}"
    
    # Parse response to show results
    SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null || echo "unknown")
    PROCESSED=$(echo "$BODY" | jq -r '.results.total // .results.processed // 0' 2>/dev/null || echo "0")
    
    if [ "$SUCCESS" = "true" ]; then
        echo ""
        echo "Results:"
        echo "  - Total jobs processed: ${PROCESSED}"
        echo ""
        echo "Next steps:"
        echo "1. Check retry job status:"
        echo "   Run: scripts/diagnose-retry-jobs.sql in SQL Editor"
        echo ""
        echo "2. Check if transcripts were fetched:"
        echo "   SELECT id, title, transcript_text IS NOT NULL as has_transcript"
        echo "   FROM meetings"
        echo "   WHERE id IN ("
        echo "     'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,"
        echo "     '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,"
        echo "     '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID"
        echo "   );"
    fi
else
    echo -e "${RED}✗ Retry processor failed${NC}"
    echo ""
    echo "Check:"
    echo "1. Service role key is correct"
    echo "2. Edge Function is deployed"
    echo "3. Check Edge Function logs in Supabase Dashboard"
fi

