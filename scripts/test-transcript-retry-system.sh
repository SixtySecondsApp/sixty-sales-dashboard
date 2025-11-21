#!/bin/bash

# Test Script for Transcript Retry System
# This script verifies the setup and tests the retry functionality

set -e

echo "🔍 Verifying Transcript Retry System Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"

# Get project details
PROJECT_REF=$(supabase status | grep "API URL" | awk '{print $3}' | sed 's|https://||' | sed 's|\.supabase\.co||' || echo "")
if [ -z "$PROJECT_REF" ]; then
    echo -e "${YELLOW}⚠ Could not detect project ref, using default${NC}"
    PROJECT_REF="ewtuefzeogytgmsnkpmb"
fi

EDGE_FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/fathom-transcript-retry"
echo "Edge Function URL: ${EDGE_FUNCTION_URL}"
echo ""

# Test 1: Verify Edge Function is deployed
echo "Test 1: Verifying Edge Function deployment..."
if curl -s -f -o /dev/null "${EDGE_FUNCTION_URL}" -H "Authorization: Bearer invalid" 2>&1 | grep -q "401\|403"; then
    echo -e "${GREEN}✓ Edge Function is deployed and accessible${NC}"
else
    echo -e "${RED}✗ Edge Function may not be deployed or accessible${NC}"
    echo "   Check: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
fi
echo ""

# Test 2: Check database setup (requires SQL execution)
echo "Test 2: Database setup verification..."
echo "   Run the following SQL in Supabase SQL Editor:"
echo "   File: scripts/verify-transcript-retry-setup.sql"
echo ""

# Test 3: Test retry processor function (requires service role key)
echo "Test 3: Testing retry processor function..."
echo "   To test manually, call the Edge Function with service role key:"
echo "   curl -X POST '${EDGE_FUNCTION_URL}' \\"
echo "     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"batch_size\": 10}'"
echo ""

# Test 4: Check for meetings without transcripts
echo "Test 4: Finding meetings that need retry jobs..."
echo "   Run this SQL to find meetings missing transcripts:"
echo ""
echo "   SELECT"
echo "     m.id,"
echo "     m.title,"
echo "     m.fathom_recording_id,"
echo "     m.transcript_fetch_attempts,"
echo "     CASE"
echo "       WHEN rtj.id IS NOT NULL THEN 'Has retry job'"
echo "       WHEN m.transcript_fetch_attempts IS NULL OR m.transcript_fetch_attempts < 5 THEN 'Needs retry job'"
echo "       ELSE 'Max attempts reached'"
echo "     END as status"
echo "   FROM meetings m"
echo "   LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id"
echo "     AND rtj.status IN ('pending', 'processing')"
echo "   WHERE m.transcript_text IS NULL"
echo "     AND m.fathom_recording_id IS NOT NULL"
echo "   ORDER BY m.created_at DESC"
echo "   LIMIT 10;"
echo ""

# Test 5: Monitor retry jobs
echo "Test 5: Monitoring retry jobs..."
echo "   Run this SQL to see pending retry jobs:"
echo ""
echo "   SELECT * FROM v_pending_transcript_retries"
echo "   ORDER BY next_retry_at ASC"
echo "   LIMIT 10;"
echo ""

echo -e "${GREEN}✅ Verification script complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run the SQL verification queries in Supabase SQL Editor"
echo "2. Check Edge Function logs: https://supabase.com/dashboard/project/${PROJECT_REF}/functions/fathom-transcript-retry/logs"
echo "3. Monitor retry jobs using the views in TRANSCRIPT_RETRY_SYSTEM.md"
echo "4. Test with a real webhook or sync to see retry jobs being created"

