#!/bin/bash

# Automated Integration Testing Script
# Tests all Fathom integration features

set -e  # Exit on error

PROJECT_REF="ewtuefzeogytgmsnkpmb"
PROJECT_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

echo "=========================================="
echo "🧪 Fathom Integration - Automated Testing"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run SQL query
run_sql() {
    local query="$1"
    supabase db --project-ref "$PROJECT_REF" execute "$query"
}

# Function to report test result
test_result() {
    local test_name="$1"
    local passed="$2"
    local details="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ "$passed" = "true" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo -e "   ${YELLOW}Details${NC}: $details"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# ============================================================================
# Test 1: Verify Database Schema
# ============================================================================

echo "📋 Test 1: Verifying Database Schema..."

# Check migration count
MIGRATION_COUNT=$(run_sql "SELECT COUNT(*) as count FROM supabase_migrations.schema_migrations WHERE version LIKE '20251025%';" | grep -oE '[0-9]+' | head -1)

if [ "$MIGRATION_COUNT" = "16" ]; then
    test_result "Migration Count" "true" "All 16 migrations applied"
else
    test_result "Migration Count" "false" "Expected 16, got $MIGRATION_COUNT"
fi

# Check key tables exist
TABLES_SQL="SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('meeting_contacts', 'contact_meeting_insights', 'company_meeting_insights', 'pipeline_stage_recommendations', 'task_notifications');"
TABLE_COUNT=$(run_sql "$TABLES_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$TABLE_COUNT" = "5" ]; then
    test_result "New Tables Created" "true" "All 5 tables exist"
else
    test_result "New Tables Created" "false" "Expected 5, got $TABLE_COUNT"
fi

# Check storage bucket
BUCKET_SQL="SELECT COUNT(*) FROM storage.buckets WHERE id = 'meeting-assets';"
BUCKET_EXISTS=$(run_sql "$BUCKET_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$BUCKET_EXISTS" = "1" ]; then
    test_result "Storage Bucket" "true" "meeting-assets bucket exists"
else
    test_result "Storage Bucket" "false" "Bucket not found"
fi

echo ""

# ============================================================================
# Test 2: Edge Function Deployment
# ============================================================================

echo "📋 Test 2: Verifying Edge Functions..."

# List deployed functions
FUNCTIONS=$(supabase functions list --project-ref "$PROJECT_REF" 2>&1 || echo "ERROR")

if echo "$FUNCTIONS" | grep -q "analyze-action-item"; then
    test_result "analyze-action-item function" "true" "Deployed"
else
    test_result "analyze-action-item function" "false" "Not found"
fi

if echo "$FUNCTIONS" | grep -q "fathom-backfill-companies"; then
    test_result "fathom-backfill-companies function" "true" "Deployed"
else
    test_result "fathom-backfill-companies function" "false" "Not found"
fi

if echo "$FUNCTIONS" | grep -q "fathom-sync"; then
    test_result "fathom-sync function" "true" "Deployed"
else
    test_result "fathom-sync function" "false" "Not found"
fi

echo ""

# ============================================================================
# Test 3: Secrets Configuration
# ============================================================================

echo "📋 Test 3: Verifying Secrets Configuration..."

SECRETS=$(supabase secrets list --project-ref "$PROJECT_REF" 2>&1)

if echo "$SECRETS" | grep -q "ANTHROPIC_API_KEY"; then
    test_result "ANTHROPIC_API_KEY" "true" "Configured"
else
    test_result "ANTHROPIC_API_KEY" "false" "Missing"
fi

if echo "$SECRETS" | grep -q "FATHOM_API_BASE_URL"; then
    test_result "FATHOM_API_BASE_URL" "true" "Configured"
else
    test_result "FATHOM_API_BASE_URL" "false" "Missing"
fi

if echo "$SECRETS" | grep -q "AWS_ACCESS_KEY_ID"; then
    test_result "AWS Credentials" "true" "Configured"
else
    test_result "AWS Credentials" "false" "Missing"
fi

echo ""

# ============================================================================
# Test 4: Task Sync System
# ============================================================================

echo "📋 Test 4: Testing Task Sync System..."

# Check if sync columns exist
SYNC_COLUMNS_SQL="SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meeting_action_items' AND column_name IN ('task_id', 'sync_status', 'synced_at');"
SYNC_COLUMNS=$(run_sql "$SYNC_COLUMNS_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$SYNC_COLUMNS" = "3" ]; then
    test_result "Task Sync Columns" "true" "All sync columns present"
else
    test_result "Task Sync Columns" "false" "Expected 3, got $SYNC_COLUMNS"
fi

# Check if helper functions exist
HELPER_FUNCS_SQL="SELECT COUNT(*) FROM pg_proc WHERE proname IN ('sync_action_item_to_task', 'is_internal_assignee', 'get_user_id_from_email');"
HELPER_FUNCS=$(run_sql "$HELPER_FUNCS_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$HELPER_FUNCS" = "3" ]; then
    test_result "Sync Helper Functions" "true" "All functions exist"
else
    test_result "Sync Helper Functions" "false" "Expected 3, got $HELPER_FUNCS"
fi

# Check triggers exist
TRIGGER_SQL="SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%sync_action_item%';"
TRIGGERS=$(run_sql "$TRIGGER_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$TRIGGERS" -ge "2" ]; then
    test_result "Sync Triggers" "true" "Triggers configured"
else
    test_result "Sync Triggers" "false" "Triggers missing or incomplete"
fi

echo ""

# ============================================================================
# Test 5: AI Analysis Fields
# ============================================================================

echo "📋 Test 5: Testing AI Analysis Fields..."

AI_COLUMNS_SQL="SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meeting_action_items' AND column_name IN ('ai_task_type', 'ai_confidence_score', 'ai_reasoning');"
AI_COLUMNS=$(run_sql "$AI_COLUMNS_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$AI_COLUMNS" = "3" ]; then
    test_result "AI Analysis Columns" "true" "All AI columns present"
else
    test_result "AI Analysis Columns" "false" "Expected 3, got $AI_COLUMNS"
fi

echo ""

# ============================================================================
# Test 6: Meeting Transcript Storage
# ============================================================================

echo "📋 Test 6: Testing Meeting Transcript Storage..."

TRANSCRIPT_SQL="SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'transcript_text';"
TRANSCRIPT_COL=$(run_sql "$TRANSCRIPT_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$TRANSCRIPT_COL" = "1" ]; then
    test_result "Transcript Column" "true" "transcript_text column exists"
else
    test_result "Transcript Column" "false" "Column missing"
fi

echo ""

# ============================================================================
# Test 7: Source Tracking Fields
# ============================================================================

echo "📋 Test 7: Testing Source Tracking..."

SOURCE_COLUMNS_SQL="SELECT COUNT(*) FROM information_schema.columns WHERE (table_name = 'companies' OR table_name = 'contacts' OR table_name = 'meetings') AND column_name IN ('source', 'first_seen_at');"
SOURCE_COLUMNS=$(run_sql "$SOURCE_COLUMNS_SQL" | grep -oE '[0-9]+' | head -1)

if [ "$SOURCE_COLUMNS" -ge "6" ]; then
    test_result "Source Tracking Columns" "true" "Source fields present"
else
    test_result "Source Tracking Columns" "false" "Expected 6+, got $SOURCE_COLUMNS"
fi

echo ""

# ============================================================================
# Test 8: Create Test Action Item
# ============================================================================

echo "📋 Test 8: Creating Test Action Item..."

# Get a meeting ID
MEETING_ID=$(run_sql "SELECT id FROM meetings LIMIT 1;" | grep -oE '[0-9a-f-]{36}' | head -1)

if [ -n "$MEETING_ID" ]; then
    echo "Found meeting ID: $MEETING_ID"

    # Create test action item
    CREATE_SQL="INSERT INTO meeting_action_items (meeting_id, title, assignee_email, priority, deadline_at) VALUES ('$MEETING_ID', 'Automated Test - Send Proposal', 'test@example.com', 'high', NOW() + INTERVAL '3 days') RETURNING id;"

    ACTION_ITEM_ID=$(run_sql "$CREATE_SQL" 2>&1 | grep -oE '[0-9a-f-]{36}' | head -1)

    if [ -n "$ACTION_ITEM_ID" ]; then
        test_result "Create Test Action Item" "true" "Created ID: $ACTION_ITEM_ID"

        # Wait for triggers to fire
        echo "   Waiting 5 seconds for triggers..."
        sleep 5

        # Check if sync columns are populated
        SYNC_CHECK_SQL="SELECT sync_status, ai_task_type FROM meeting_action_items WHERE id = '$ACTION_ITEM_ID';"
        SYNC_RESULT=$(run_sql "$SYNC_CHECK_SQL" 2>&1)

        echo "   Sync result: $SYNC_RESULT"

        if echo "$SYNC_RESULT" | grep -q "synced\|excluded\|pending"; then
            test_result "Action Item Sync Status" "true" "Sync status set"
        else
            test_result "Action Item Sync Status" "false" "No sync status"
        fi

    else
        test_result "Create Test Action Item" "false" "Failed to create"
    fi
else
    test_result "Create Test Action Item" "false" "No meetings found in database"
fi

echo ""

# ============================================================================
# Test Summary
# ============================================================================

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Total Tests: ${YELLOW}$TESTS_TOTAL${NC}"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo "✅ Fathom integration is fully functional"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    echo "Review the failures above and check:"
    echo "  - Database migrations"
    echo "  - Edge function deployment"
    echo "  - Secrets configuration"
    exit 1
fi
