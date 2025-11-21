#!/bin/bash

# Fetch Missing Transcripts - Complete Script
# This script enqueues retry jobs and immediately triggers the retry processor

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Fetching Missing Transcripts${NC}"
echo ""

# Check if service role key is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    echo "Please set it: export SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
    read -sp "Or enter it now: " SUPABASE_SERVICE_ROLE_KEY
    echo ""
fi

PROJECT_REF="ewtuefzeogytgmsnkpmb"
EDGE_FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/fathom-transcript-retry"

echo -e "${BLUE}Step 1: Enqueueing retry jobs...${NC}"
echo "Run this SQL in Supabase SQL Editor:"
echo ""
echo "SELECT enqueue_transcript_retry("
echo "  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,"
echo "  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,"
echo "  'test123',"
echo "  1"
echo ");"
echo ""
echo "SELECT enqueue_transcript_retry("
echo "  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,"
echo "  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,"
echo "  '103141010',"
echo "  2"
echo ");"
echo ""
echo "SELECT enqueue_transcript_retry("
echo "  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID,"
echo "  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,"
echo "  'test-final-001',"
echo "  5"
echo ");"
echo ""
read -p "Press Enter after running the SQL above..."

echo ""
echo -e "${BLUE}Step 2: Triggering retry processor...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${EDGE_FUNCTION_URL}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Retry processor executed successfully${NC}"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Parse results
    SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null || echo "unknown")
    TOTAL=$(echo "$BODY" | jq -r '.results.total // 0' 2>/dev/null || echo "0")
    SUCCESSFUL=$(echo "$BODY" | jq -r '.results.successful // 0' 2>/dev/null || echo "0")
    FAILED=$(echo "$BODY" | jq -r '.results.failed // 0' 2>/dev/null || echo "0")
    RETRIED=$(echo "$BODY" | jq -r '.results.retried // 0' 2>/dev/null || echo "0")
    
    if [ "$SUCCESS" = "true" ]; then
        echo ""
        echo "Results Summary:"
        echo "  - Total jobs processed: ${TOTAL}"
        echo "  - Successful: ${SUCCESSFUL}"
        echo "  - Failed: ${FAILED}"
        echo "  - Retried (will try again): ${RETRIED}"
        echo ""
    fi
else
    echo -e "${RED}✗ Retry processor failed${NC}"
    echo "Response: $BODY"
    exit 1
fi

echo -e "${BLUE}Step 3: Checking results...${NC}"
echo ""
echo "Run this SQL to check if transcripts were fetched:"
echo ""
echo "SELECT "
echo "  id,"
echo "  title,"
echo "  transcript_text IS NOT NULL as has_transcript,"
echo "  LENGTH(transcript_text) as transcript_length,"
echo "  transcript_fetch_attempts"
echo "FROM meetings"
echo "WHERE id IN ("
echo "  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,"
echo "  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,"
echo "  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID"
echo ");"
echo ""
echo "Or check retry job status:"
echo ""
echo "SELECT * FROM v_pending_transcript_retries"
echo "WHERE meeting_id IN ("
echo "  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,"
echo "  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,"
echo "  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID"
echo ");"

