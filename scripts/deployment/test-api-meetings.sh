#!/bin/bash

# Comprehensive Meetings API Test Script
# Tests all CRUD operations, filtering, pagination, webhooks, and error cases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
API_KEY=${API_KEY:-"your_api_key_here"}
TEST_PREFIX="test-meeting-$(date +%s)"

# Global variables
CREATED_MEETING_ID=""
CREATED_DEAL_ID=""
WEBHOOK_SHARE_ID=""

# Utility functions
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Assert response contains expected data
assert_response() {
    local response="$1"
    local expected_pattern="$2"
    local test_name="$3"
    
    if echo "$response" | grep -q "$expected_pattern"; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name"
        echo "Response: $response"
        return 1
    fi
}

# Assert HTTP status code
assert_status() {
    local status="$1"
    local expected="$2"
    local test_name="$3"
    
    if [ "$status" -eq "$expected" ]; then
        log_pass "$test_name - Status $status"
        return 0
    else
        log_fail "$test_name - Expected $expected, got $status"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test data..."
    
    # Delete created meeting
    if [ ! -z "$CREATED_MEETING_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted meeting $CREATED_MEETING_ID"
    fi
    
    # Delete created deal
    if [ ! -z "$CREATED_DEAL_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted deal $CREATED_DEAL_ID"
    fi
}

# Trap to ensure cleanup runs on exit
trap cleanup EXIT

# Test functions
test_api_authentication() {
    log_test "Testing API Authentication"
    
    # Test missing API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_setup_prerequisites() {
    log_test "Setting Up Prerequisites (Deal for Meeting Association)"
    
    # Create a simple deal for meeting association
    deal_response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Deal for Meetings\",
            \"company\": \"${TEST_PREFIX} Company\",
            \"value\": 25000,
            \"stage_id\": \"00000000-0000-0000-0000-000000000001\"
        }")
    
    deal_status=$(echo "$deal_response" | tail -n1)
    deal_body=$(echo "$deal_response" | head -n -1)
    
    if [ "$deal_status" -eq "201" ]; then
        CREATED_DEAL_ID=$(echo "$deal_body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
        log_pass "Created test deal: $CREATED_DEAL_ID"
    else
        log_info "Could not create test deal - continuing without deal association"
    fi
}

test_create_meeting() {
    log_test "Testing Meeting Creation"
    
    # Calculate start and end times (tomorrow at 2 PM and 3 PM)
    start_time=$(date -u -v +1d +"%Y-%m-%dT14:00:00Z" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%dT14:00:00Z" 2>/dev/null || echo "2025-02-01T14:00:00Z")
    end_time=$(date -u -v +1d +"%Y-%m-%dT15:00:00Z" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%dT15:00:00Z" 2>/dev/null || echo "2025-02-01T15:00:00Z")
    
    # Test successful meeting creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TEST_PREFIX} Product Demo\",
            \"description\": \"Demo of key product features and Q&A\",
            \"meeting_type\": \"demo\",
            \"status\": \"scheduled\",
            \"start_time\": \"$start_time\",
            \"end_time\": \"$end_time\",
            \"duration_minutes\": 60,
            \"attendees\": [\"client@example.com\", \"sales@ourcompany.com\"],
            \"location\": \"Zoom\",
            \"meeting_url\": \"https://zoom.us/j/123456789\",
            \"deal_id\": \"$CREATED_DEAL_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Meeting creation should return 201"
    assert_response "$body" "${TEST_PREFIX} Product Demo" "Response should contain meeting title"
    assert_response "$body" "demo" "Response should contain meeting type"
    assert_response "$body" "scheduled" "Response should contain status"
    
    # Extract meeting ID for further tests
    CREATED_MEETING_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created meeting ID: $CREATED_MEETING_ID"
    
    # Test validation errors - missing required title
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"description": "A meeting without title"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required fields should return 400"
    
    # Test missing start_time
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title": "Test Meeting"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing start_time should return 400"
    
    # Test invalid meeting_type
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"title\": \"Test Meeting\", \"start_time\": \"$start_time\", \"meeting_type\": \"invalid_type\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid meeting_type should return 400"
    
    # Test invalid status
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"title\": \"Test Meeting\", \"start_time\": \"$start_time\", \"status\": \"invalid_status\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid status should return 400"
}

test_get_meetings() {
    log_test "Testing Meeting Retrieval"
    
    # Test list meetings
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List meetings should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    assert_response "$body" '"count"' "Response should contain count"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Pagination should work"
    assert_response "$body" '"pagination"' "Response should contain pagination info"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?search=${TEST_PREFIX}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Search should work"
    if [ ! -z "$CREATED_MEETING_ID" ]; then
        assert_response "$body" "$TEST_PREFIX" "Search results should contain test meeting"
    fi
}

test_get_single_meeting() {
    log_test "Testing Single Meeting Retrieval"
    
    if [ -z "$CREATED_MEETING_ID" ]; then
        log_fail "Cannot test single meeting - no meeting ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single meeting should return 200"
    assert_response "$body" "$CREATED_MEETING_ID" "Response should contain meeting ID"
    assert_response "$body" "${TEST_PREFIX}" "Response should contain meeting title"
    assert_response "$body" '"attendee_count"' "Response should include attendee count"
    assert_response "$body" '"is_upcoming"' "Response should include upcoming status"
    
    # Test non-existent meeting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent meeting should return 404"
}

test_update_meeting() {
    log_test "Testing Meeting Updates"
    
    if [ -z "$CREATED_MEETING_ID" ]; then
        log_fail "Cannot test update - no meeting ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TEST_PREFIX} Updated Product Demo\",
            \"status\": \"in_progress\",
            \"meeting_type\": \"proposal\",
            \"description\": \"Updated demo with proposal discussion\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Meeting update should return 200"
    assert_response "$body" "Updated Product Demo" "Updated meeting should contain new title"
    assert_response "$body" "in_progress" "Updated meeting should contain new status"
    assert_response "$body" "proposal" "Updated meeting should contain new type"
    
    # Test partial update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"status": "completed"}')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Partial update should work"
    assert_response "$body" "completed" "Partial update should contain new status"
    
    # Test validation on update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"meeting_type": "invalid_type"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid meeting_type on update should return 400"
}

test_meeting_filtering() {
    log_test "Testing Meeting Filtering"
    
    # Test meeting_type filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?meeting_type=proposal" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Meeting type filter should work"
    
    # Test status filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?status=completed" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Status filter should work"
    
    # Test upcoming filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?upcoming=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Upcoming filter should work"
    
    # Test today filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?today=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Today filter should work"
    
    # Test past meetings filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?past=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Past meetings filter should work"
    
    # Test date range filtering
    today=$(date -u +"%Y-%m-%d")
    tomorrow=$(date -u -v +1d +"%Y-%m-%d" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%d" 2>/dev/null || echo "2025-02-01")
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?start_after=${today}T00:00:00Z&start_before=${tomorrow}T23:59:59Z" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Date range filtering should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings?sort=start_time&order=asc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting by start_time should work"
}

test_meeting_types() {
    log_test "Testing Valid Meeting Types"
    
    valid_types=("discovery" "demo" "proposal" "negotiation" "onboarding" "check_in" "other")
    
    for meeting_type in "${valid_types[@]}"; do
        # Create a test meeting with this type
        start_time=$(date -u -v +2d +"%Y-%m-%dT10:00:00Z" 2>/dev/null || date -u -d "+2 days" +"%Y-%m-%dT10:00:00Z" 2>/dev/null || echo "2025-02-02T10:00:00Z")
        
        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-meetings" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"title\": \"Test ${meeting_type} Meeting\",
                \"meeting_type\": \"$meeting_type\",
                \"start_time\": \"$start_time\"
            }")
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "201" ]; then
            log_pass "Meeting type '$meeting_type' is valid"
            
            # Clean up the created meeting
            body=$(echo "$response" | head -n -1)
            temp_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
            if [ ! -z "$temp_id" ]; then
                curl -s -X DELETE \
                    "$BASE_URL/api-v1-meetings/$temp_id" \
                    -H "X-API-Key: $API_KEY" > /dev/null
            fi
        else
            log_fail "Meeting type '$meeting_type' failed - Status $status"
        fi
        
        # Small delay between requests
        sleep 0.5
    done
}

test_meeting_statuses() {
    log_test "Testing Valid Meeting Statuses"
    
    if [ -z "$CREATED_MEETING_ID" ]; then
        log_fail "Cannot test status transitions - no meeting ID available"
        return 1
    fi
    
    valid_statuses=("scheduled" "in_progress" "completed" "cancelled" "no_show")
    
    for status_val in "${valid_statuses[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status_val\"}")
        
        status=$(echo "$response" | tail -n1)
        if [ "$status" -eq "200" ]; then
            log_pass "Status transition to $status_val works"
        else
            log_fail "Status transition to $status_val failed - Status $status"
        fi
        
        # Small delay between requests
        sleep 0.5
    done
}

test_webhook_integration() {
    log_test "Testing Webhook Integration"
    
    # Generate a unique share ID for webhook testing
    WEBHOOK_SHARE_ID="webhook-test-$(date +%s)"
    
    log_info "Testing webhook with share ID: $WEBHOOK_SHARE_ID"
    
    # Test summary webhook
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/meetings-webhook" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"topic\": \"summary\",
            \"shareId\": \"$WEBHOOK_SHARE_ID\",
            \"recording\": {
                \"recording_url\": \"https://fathom.video/calls/test123\",
                \"recording_share_url\": \"https://fathom.video/share/$WEBHOOK_SHARE_ID\",
                \"recording_duration_in_minutes\": 30
            },
            \"meeting\": {
                \"scheduled_start_time\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
                \"scheduled_end_time\": \"$(date -u -v +30M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+30 minutes" +"%Y-%m-%dT%H:%M:%SZ")\",
                \"title\": \"${TEST_PREFIX} Webhook Test Meeting\",
                \"invitees\": [
                    {\"name\": \"Test User\", \"email\": \"test@example.com\"}
                ]
            },
            \"fathom_user\": {
                \"name\": \"API Tester\",
                \"email\": \"test@example.com\",
                \"team\": \"Sales\"
            },
            \"ai_summary\": \"Test summary from webhook integration test\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Summary webhook should return 200"
    assert_response "$body" "success" "Webhook should return success"
    
    # Extract meeting ID from webhook response if available
    webhook_meeting_id=$(echo "$body" | grep -o '"meetingId":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    # Test action items webhook
    if [ ! -z "$webhook_meeting_id" ] || [ "$status" -eq "200" ]; then
        sleep 2  # Give the database a moment
        
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/meetings-webhook" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"topic\": \"action_items\",
                \"shareId\": \"$WEBHOOK_SHARE_ID\",
                \"action_item\": {
                    \"description\": \"Follow up with client\",
                    \"completed\": false,
                    \"ai_generated\": true,
                    \"recording_timestamp\": \"00:15:30\"
                },
                \"assignee\": {
                    \"name\": \"API Tester\",
                    \"email\": \"test@example.com\",
                    \"team\": \"Sales\"
                },
                \"deadline_days\": 3,
                \"priority\": \"medium\"
            }")
        
        status=$(echo "$response" | tail -n1)
        assert_status "$status" "200" "Action items webhook should return 200"
    fi
    
    # Test transcript webhook
    if [ ! -z "$webhook_meeting_id" ] || [ "$status" -eq "200" ]; then
        sleep 1
        
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/meetings-webhook" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"topic\": \"transcript\",
                \"shareId\": \"$WEBHOOK_SHARE_ID\",
                \"transcript_url\": \"https://example.com/transcript/test\"
            }")
        
        status=$(echo "$response" | tail -n1)
        assert_status "$status" "200" "Transcript webhook should return 200"
    fi
}

test_delete_meeting() {
    log_test "Testing Meeting Deletion"
    
    if [ -z "$CREATED_MEETING_ID" ]; then
        log_fail "Cannot test deletion - no meeting ID available"
        return 1
    fi
    
    # Test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Meeting deletion should return 200"
    
    # Verify meeting is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-meetings/$CREATED_MEETING_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted meeting should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_MEETING_ID=""
    
    # Test deleting non-existent meeting
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-meetings/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent meeting should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -I \
        "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY")
    
    if echo "$response" | grep -q "X-RateLimit-Limit"; then
        log_pass "Rate limit headers present"
    else
        log_fail "Rate limit headers missing"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "     MEETINGS API COMPREHENSIVE TESTS    "
    echo "=========================================="
    echo ""
    
    log_info "API Key: ${API_KEY:0:10}..."
    log_info "Base URL: $BASE_URL"
    log_info "Test Prefix: $TEST_PREFIX"
    echo ""
    
    # Check if API key is set
    if [ "$API_KEY" = "your_api_key_here" ]; then
        log_fail "Please set API_KEY environment variable"
        exit 1
    fi
    
    # Run all tests
    test_api_authentication
    echo ""
    
    test_setup_prerequisites
    echo ""
    
    test_create_meeting
    echo ""
    
    test_get_meetings
    echo ""
    
    test_get_single_meeting
    echo ""
    
    test_update_meeting
    echo ""
    
    test_meeting_filtering
    echo ""
    
    test_meeting_types
    echo ""
    
    test_meeting_statuses
    echo ""
    
    test_webhook_integration
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_meeting
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"