#!/bin/bash

# Comprehensive Activities API Test Script
# Tests all CRUD operations, filtering, pagination, and error cases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
API_KEY=${API_KEY:-"your_api_key_here"}
TEST_PREFIX="test-activity-$(date +%s)"

# Global variables
CREATED_ACTIVITY_ID=""
CREATED_DEAL_ID=""
CREATED_COMPANY_ID=""
CREATED_CONTACT_ID=""

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
    
    # Delete created activity
    if [ ! -z "$CREATED_ACTIVITY_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted activity $CREATED_ACTIVITY_ID"
    fi
    
    # Delete created deal
    if [ ! -z "$CREATED_DEAL_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted deal $CREATED_DEAL_ID"
    fi
    
    # Delete created contact
    if [ ! -z "$CREATED_CONTACT_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted contact $CREATED_CONTACT_ID"
    fi
    
    # Delete created company
    if [ ! -z "$CREATED_COMPANY_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted company $CREATED_COMPANY_ID"
    fi
}

# Trap to ensure cleanup runs on exit
trap cleanup EXIT

# Test functions
test_api_authentication() {
    log_test "Testing API Authentication"
    
    # Test missing API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_setup_prerequisites() {
    log_test "Setting Up Prerequisites (Company, Contact, and Deal)"
    
    # Create a company
    company_response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Company\",
            \"website\": \"https://${TEST_PREFIX}.com\",
            \"industry\": \"Technology\"
        }")
    
    company_status=$(echo "$company_response" | tail -n1)
    company_body=$(echo "$company_response" | head -n -1)
    
    if [ "$company_status" -eq "201" ]; then
        CREATED_COMPANY_ID=$(echo "$company_body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
        log_pass "Created test company: $CREATED_COMPANY_ID"
    else
        log_info "Could not create test company"
    fi
    
    # Create a contact
    if [ ! -z "$CREATED_COMPANY_ID" ]; then
        contact_response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-contacts" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"first_name\": \"Test\",
                \"last_name\": \"Contact\",
                \"email\": \"test-${TEST_PREFIX}@example.com\",
                \"company_id\": \"$CREATED_COMPANY_ID\"
            }")
        
        contact_status=$(echo "$contact_response" | tail -n1)
        contact_body=$(echo "$contact_response" | head -n -1)
        
        if [ "$contact_status" -eq "201" ]; then
            CREATED_CONTACT_ID=$(echo "$contact_body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
            log_pass "Created test contact: $CREATED_CONTACT_ID"
        else
            log_info "Could not create test contact"
        fi
    fi
    
    # Create a deal
    if [ ! -z "$CREATED_COMPANY_ID" ]; then
        deal_response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-deals" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"${TEST_PREFIX} Deal for Activities\",
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
            log_info "Could not create test deal"
        fi
    fi
}

test_create_activity() {
    log_test "Testing Activity Creation"
    
    # Calculate activity date (today)
    activity_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Test successful activity creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"outbound\",
            \"subject\": \"${TEST_PREFIX} Discovery Call\",
            \"client_name\": \"${TEST_PREFIX} Test Client\",
            \"sales_rep\": \"test@example.com\",
            \"details\": \"Initial discovery call to understand client requirements\",
            \"amount\": 0,
            \"date\": \"$activity_date\",
            \"status\": \"completed\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Activity creation should return 201"
    assert_response "$body" "${TEST_PREFIX} Discovery Call" "Response should contain activity subject"
    assert_response "$body" "outbound" "Response should contain activity type"
    # Outcome field doesn't exist in activities table - skip this test
    
    # Extract activity ID for further tests
    CREATED_ACTIVITY_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created activity ID: $CREATED_ACTIVITY_ID"
    
    # Test validation errors - missing required type
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"subject": "Test Activity", "client_name": "Test Client", "sales_rep": "test@example.com", "date": "'$activity_date'"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required type should return 400"
    
    # Test missing subject
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"type": "outbound", "client_name": "Test Client", "sales_rep": "test@example.com", "date": "'$activity_date'"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required subject should return 400"
    
    # Test missing date
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"type": "outbound", "subject": "Test Activity", "client_name": "Test Client", "sales_rep": "test@example.com"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required date should return 400"
    
    # Test invalid activity type
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"type\": \"invalid_type\", \"subject\": \"Test\", \"client_name\": \"Test Client\", \"sales_rep\": \"test@example.com\", \"date\": \"$activity_date\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid activity type should return 400"
    
    # Test invalid status
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"type\": \"outbound\", \"subject\": \"Test\", \"client_name\": \"Test Client\", \"sales_rep\": \"test@example.com\", \"date\": \"$activity_date\", \"status\": \"invalid_status\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid status should return 400"
    
    # Test invalid outcome
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"type\": \"outbound\", \"subject\": \"Test\", \"client_name\": \"Test Client\", \"sales_rep\": \"test@example.com\", \"date\": \"$activity_date\", \"priority\": \"invalid_priority\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid priority should return 400"
}

test_get_activities() {
    log_test "Testing Activity Retrieval"
    
    # Test list activities
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List activities should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    assert_response "$body" '"count"' "Response should contain count"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Pagination should work"
    assert_response "$body" '"pagination"' "Response should contain pagination info"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?search=${TEST_PREFIX}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Search should work"
    if [ ! -z "$CREATED_ACTIVITY_ID" ]; then
        assert_response "$body" "$TEST_PREFIX" "Search results should contain test activity"
    fi
}

test_get_single_activity() {
    log_test "Testing Single Activity Retrieval"
    
    if [ -z "$CREATED_ACTIVITY_ID" ]; then
        log_fail "Cannot test single activity - no activity ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single activity should return 200"
    assert_response "$body" "$CREATED_ACTIVITY_ID" "Response should contain activity ID"
    assert_response "$body" "${TEST_PREFIX}" "Response should contain activity subject"
    assert_response "$body" '"days_ago"' "Response should include days ago calculation"
    
    # Test non-existent activity
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent activity should return 404"
}

test_update_activity() {
    log_test "Testing Activity Updates"
    
    if [ -z "$CREATED_ACTIVITY_ID" ]; then
        log_fail "Cannot test update - no activity ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"subject\": \"${TEST_PREFIX} Updated Discovery Call\",
            \"type\": \"meeting\",
            \"outcome\": \"neutral\",
            \"details\": \"Updated activity details after follow-up\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Activity update should return 200"
    assert_response "$body" "Updated Discovery Call" "Updated activity should contain new subject"
    assert_response "$body" "meeting" "Updated activity should contain new type"
    assert_response "$body" "neutral" "Updated activity should contain new outcome"
    
    # Test partial update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"status": "pending"}')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Partial update should work"
    assert_response "$body" "pending" "Partial update should contain new status"
    
    # Test validation on update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"type": "invalid_type"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid type on update should return 400"
}

test_activity_filtering() {
    log_test "Testing Activity Filtering"
    
    # Test type filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?type=meeting" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Type filter should work"
    
    # Test status filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?status=completed" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Status filter should work"
    
    # Test outcome filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?outcome=positive" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Outcome filter should work"
    
    # Test date range filtering
    today=$(date -u +"%Y-%m-%d")
    yesterday=$(date -u -v -1d +"%Y-%m-%d" 2>/dev/null || date -u -d "-1 day" +"%Y-%m-%d" 2>/dev/null || echo "2025-01-01")
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?date_from=${yesterday}&date_to=${today}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Date range filtering should work"
    
    # Test this_week filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?this_week=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "This week filter should work"
    
    # Test this_month filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?this_month=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "This month filter should work"
    
    # Test amount range filtering
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?min_amount=0&max_amount=1000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Amount range filtering should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities?sort=date&order=desc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting by date should work"
}

test_activity_types() {
    log_test "Testing Valid Activity Types"
    
    valid_types=("outbound" "meeting" "proposal" "sale")
    activity_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    for activity_type in "${valid_types[@]}"; do
        # Create a test activity with this type
        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-activities" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"type\": \"$activity_type\",
                \"subject\": \"Test ${activity_type} Activity\",
                \"client_name\": \"Test Client\",
                \"sales_rep\": \"test@example.com\",
                \"date\": \"$activity_date\"
            }")
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "201" ]; then
            log_pass "Activity type '$activity_type' is valid"
            
            # Clean up the created activity
            body=$(echo "$response" | head -n -1)
            temp_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
            if [ ! -z "$temp_id" ]; then
                curl -s -X DELETE \
                    "$BASE_URL/api-v1-activities/$temp_id" \
                    -H "X-API-Key: $API_KEY" > /dev/null
            fi
        else
            log_fail "Activity type '$activity_type' failed - Status $status"
        fi
        
        # Small delay between requests
        sleep 0.5
    done
}

test_activity_statuses() {
    log_test "Testing Valid Activity Statuses"
    
    if [ -z "$CREATED_ACTIVITY_ID" ]; then
        log_fail "Cannot test status transitions - no activity ID available"
        return 1
    fi
    
    valid_statuses=("completed" "pending" "cancelled")
    
    for status_val in "${valid_statuses[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
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

test_activity_outcomes() {
    log_test "Testing Valid Activity Outcomes"
    
    if [ -z "$CREATED_ACTIVITY_ID" ]; then
        log_fail "Cannot test outcome transitions - no activity ID available"
        return 1
    fi
    
    valid_outcomes=("positive" "neutral" "negative")
    
    for outcome_val in "${valid_outcomes[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"outcome\": \"$outcome_val\"}")
        
        status=$(echo "$response" | tail -n1)
        if [ "$status" -eq "200" ]; then
            log_pass "Outcome transition to $outcome_val works"
        else
            log_fail "Outcome transition to $outcome_val failed - Status $status"
        fi
        
        # Small delay between requests
        sleep 0.5
    done
}

test_activity_with_amount() {
    log_test "Testing Activity with Revenue Amount"
    
    activity_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create a sale activity with amount
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"sale\",
            \"subject\": \"${TEST_PREFIX} Sale Activity\",
            \"client_name\": \"${TEST_PREFIX} Test Client\",
            \"sales_rep\": \"test@example.com\",
            \"details\": \"Closed deal with revenue amount\",
            \"amount\": 5000,
            \"date\": \"$activity_date\",
            \"status\": \"completed\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Sale activity creation should return 201"
    assert_response "$body" "5000" "Response should contain amount"
    assert_response "$body" "sale" "Response should contain sale type"
    
    # Clean up the created activity
    temp_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    if [ ! -z "$temp_id" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-activities/$temp_id" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Cleaned up sale activity: $temp_id"
    fi
}

test_delete_activity() {
    log_test "Testing Activity Deletion"
    
    if [ -z "$CREATED_ACTIVITY_ID" ]; then
        log_fail "Cannot test deletion - no activity ID available"
        return 1
    fi
    
    # Test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Activity deletion should return 200"
    
    # Verify activity is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-activities/$CREATED_ACTIVITY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted activity should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_ACTIVITY_ID=""
    
    # Test deleting non-existent activity
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-activities/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent activity should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -I \
        "$BASE_URL/api-v1-activities" \
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
    echo "    ACTIVITIES API COMPREHENSIVE TESTS   "
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
    
    test_create_activity
    echo ""
    
    test_get_activities
    echo ""
    
    test_get_single_activity
    echo ""
    
    test_update_activity
    echo ""
    
    test_activity_filtering
    echo ""
    
    test_activity_types
    echo ""
    
    test_activity_statuses
    echo ""
    
    test_activity_outcomes
    echo ""
    
    test_activity_with_amount
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_activity
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"