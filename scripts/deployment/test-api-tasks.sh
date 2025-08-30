#!/bin/bash

# Comprehensive Tasks API Test Script
# Tests all CRUD operations, filtering, pagination, permissions, and error cases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
API_KEY=${API_KEY:-"your_api_key_here"}
TEST_PREFIX="test-task-$(date +%s)"

# Global variables
CREATED_TASK_ID=""
CREATED_DEAL_ID=""
CREATED_COMPANY_ID=""
STAGE_ID=""
USER_ID=""

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
    
    # Delete created task
    if [ ! -z "$CREATED_TASK_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted task $CREATED_TASK_ID"
    fi
    
    # Delete created deal
    if [ ! -z "$CREATED_DEAL_ID" ]; then
        curl -s -X DELETE \
            "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted deal $CREATED_DEAL_ID"
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

# Get valid IDs for testing
get_stage_id() {
    # Use a fallback stage ID for testing
    STAGE_ID="00000000-0000-0000-0000-000000000001"
    log_info "Using fallback stage ID: $STAGE_ID"
}

get_user_id() {
    # Use a fallback user ID for testing
    USER_ID="00000000-0000-0000-0000-000000000002"
    log_info "Using fallback user ID: $USER_ID"
}

# Test functions
test_api_authentication() {
    log_test "Testing API Authentication"
    
    # Test missing API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_setup_prerequisites() {
    log_test "Setting Up Prerequisites (Deal for Task Association)"
    
    get_stage_id
    get_user_id
    
    # Create a company first
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
        log_info "Could not create test company - continuing without deal association"
    fi
    
    # Create a deal for task association
    if [ ! -z "$CREATED_COMPANY_ID" ]; then
        deal_response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-deals" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"${TEST_PREFIX} Deal for Tasks\",
                \"company\": \"${TEST_PREFIX} Company\",
                \"value\": 25000,
                \"stage_id\": \"$STAGE_ID\"
            }")
        
        deal_status=$(echo "$deal_response" | tail -n1)
        deal_body=$(echo "$deal_response" | head -n -1)
        
        if [ "$deal_status" -eq "201" ]; then
            CREATED_DEAL_ID=$(echo "$deal_body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
            log_pass "Created test deal: $CREATED_DEAL_ID"
        else
            log_info "Could not create test deal - continuing without deal association"
        fi
    fi
}

test_create_task() {
    log_test "Testing Task Creation"
    
    # Calculate due date (3 days from now)
    due_date=$(date -u -v +3d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+3 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2025-02-01T10:00:00Z")
    
    # Test successful task creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TEST_PREFIX} Follow up with client\",
            \"description\": \"Send follow-up email and schedule next meeting\",
            \"status\": \"todo\",
            \"priority\": \"high\",
            \"due_date\": \"$due_date\",
            \"assigned_to\": \"$USER_ID\",
            \"deal_id\": \"$CREATED_DEAL_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Task creation should return 201"
    assert_response "$body" "${TEST_PREFIX} Follow up" "Response should contain task title"
    assert_response "$body" "high" "Response should contain priority"
    assert_response "$body" "todo" "Response should contain status"
    
    # Extract task ID for further tests
    CREATED_TASK_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created task ID: $CREATED_TASK_ID"
    
    # Test validation errors - missing required title
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"description": "A task without title"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required fields should return 400"
    
    # Test invalid status value
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title": "Test Task", "status": "invalid_status"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid status should return 400"
    
    # Test invalid priority value
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title": "Test Task", "priority": "invalid_priority"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid priority should return 400"
}

test_get_tasks() {
    log_test "Testing Task Retrieval"
    
    # Test list tasks
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List tasks should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    assert_response "$body" '"count"' "Response should contain count"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Pagination should work"
    assert_response "$body" '"pagination"' "Response should contain pagination info"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?search=${TEST_PREFIX}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Search should work"
    if [ ! -z "$CREATED_TASK_ID" ]; then
        assert_response "$body" "$TEST_PREFIX" "Search results should contain test task"
    fi
}

test_get_single_task() {
    log_test "Testing Single Task Retrieval"
    
    if [ -z "$CREATED_TASK_ID" ]; then
        log_fail "Cannot test single task - no task ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single task should return 200"
    assert_response "$body" "$CREATED_TASK_ID" "Response should contain task ID"
    assert_response "$body" "${TEST_PREFIX}" "Response should contain task title"
    assert_response "$body" '"is_overdue"' "Response should include overdue status"
    assert_response "$body" '"days_until_due"' "Response should include days until due"
    
    # Test non-existent task
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent task should return 404"
}

test_update_task() {
    log_test "Testing Task Updates"
    
    if [ -z "$CREATED_TASK_ID" ]; then
        log_fail "Cannot test update - no task ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TEST_PREFIX} Updated Task\",
            \"status\": \"in_progress\",
            \"priority\": \"urgent\",
            \"description\": \"Updated task description\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Task update should return 200"
    assert_response "$body" "Updated Task" "Updated task should contain new title"
    assert_response "$body" "in_progress" "Updated task should contain new status"
    assert_response "$body" "urgent" "Updated task should contain new priority"
    
    # Test partial update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"status": "completed"}')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Partial update should work"
    assert_response "$body" "completed" "Partial update should contain new status"
    
    # Test validation on update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"status": "invalid_status"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid status on update should return 400"
}

test_task_filtering() {
    log_test "Testing Task Filtering"
    
    # Test status filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?status=completed" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Status filter should work"
    
    # Test priority filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?priority=urgent" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Priority filter should work"
    
    # Test assigned_to filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?assigned_to=$USER_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Assigned_to filter should work"
    
    # Test deal_id filter
    if [ ! -z "$CREATED_DEAL_ID" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/api-v1-tasks?deal_id=$CREATED_DEAL_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        assert_status "$status" "200" "Deal ID filter should work"
    fi
    
    # Test due date filters
    today=$(date -u +"%Y-%m-%d")
    tomorrow=$(date -u -v +1d +"%Y-%m-%d" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%d" 2>/dev/null || echo "2025-02-01")
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?due_after=$today&due_before=$tomorrow" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Date range filter should work"
    
    # Test overdue filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?overdue=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Overdue filter should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks?sort=due_date&order=asc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting by due date should work"
}

test_task_status_transitions() {
    log_test "Testing Task Status Transitions"
    
    if [ -z "$CREATED_TASK_ID" ]; then
        log_fail "Cannot test status transitions - no task ID available"
        return 1
    fi
    
    # Test valid status transitions
    valid_statuses=("todo" "in_progress" "completed" "cancelled")
    
    for status_val in "${valid_statuses[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
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

test_task_priority_levels() {
    log_test "Testing Task Priority Levels"
    
    if [ -z "$CREATED_TASK_ID" ]; then
        log_fail "Cannot test priority levels - no task ID available"
        return 1
    fi
    
    # Test valid priority levels
    valid_priorities=("low" "medium" "high" "urgent")
    
    for priority_val in "${valid_priorities[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"priority\": \"$priority_val\"}")
        
        status=$(echo "$response" | tail -n1)
        if [ "$status" -eq "200" ]; then
            log_pass "Priority level $priority_val works"
        else
            log_fail "Priority level $priority_val failed - Status $status"
        fi
        
        # Small delay between requests
        sleep 0.5
    done
}

test_task_permissions() {
    log_test "Testing Task Permission Rules"
    
    # Note: This test assumes the API implements permission checks
    # In a real implementation, you'd test with different user contexts
    
    log_info "Permission tests require different user contexts - skipping for now"
    log_info "In full implementation, test:"
    log_info "  - Non-admins can only edit tasks they created or are assigned to"
    log_info "  - Non-admins can only delete tasks they created"
}

test_delete_task() {
    log_test "Testing Task Deletion"
    
    if [ -z "$CREATED_TASK_ID" ]; then
        log_fail "Cannot test deletion - no task ID available"
        return 1
    fi
    
    # Test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Task deletion should return 200"
    
    # Verify task is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-tasks/$CREATED_TASK_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted task should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_TASK_ID=""
    
    # Test deleting non-existent task
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-tasks/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent task should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -I \
        "$BASE_URL/api-v1-tasks" \
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
    echo "     TASKS API COMPREHENSIVE TESTS       "
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
    
    test_create_task
    echo ""
    
    test_get_tasks
    echo ""
    
    test_get_single_task
    echo ""
    
    test_update_task
    echo ""
    
    test_task_filtering
    echo ""
    
    test_task_status_transitions
    echo ""
    
    test_task_priority_levels
    echo ""
    
    test_task_permissions
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_task
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"