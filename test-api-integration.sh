#!/bin/bash

# CRM API Integration Test Script
# Tests complete workflows with related data across all entities

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
API_KEY=${API_KEY:-"your_api_key_here"}
TEST_PREFIX="integration-test-$(date +%s)"

# Global variables for tracking created entities
COMPANY_ID=""
CONTACT_ID=""
DEAL_ID=""
TASK_ID=""
MEETING_ID=""
ACTIVITY_ID=""
STAGE_ID="00000000-0000-0000-0000-000000000001"  # Fallback stage ID

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_test() {
    echo -e "${BLUE}[INTEGRATION]${NC} $1"
    ((TOTAL_TESTS++))
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
    echo ""
}

# Extract ID from response
extract_id() {
    local response="$1"
    echo "$response" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4
}

# Test API response
test_response() {
    local response="$1"
    local status="$2"
    local expected_status="$3"
    local test_name="$4"
    local id_var="$5"
    
    if [ "$status" -eq "$expected_status" ]; then
        log_pass "$test_name"
        
        if [ ! -z "$id_var" ] && [ "$expected_status" -eq "201" ]; then
            local entity_id=$(extract_id "$response")
            eval "$id_var='$entity_id'"
            log_info "Created $id_var: $entity_id"
        fi
        return 0
    else
        log_fail "$test_name - Expected $expected_status, got $status"
        echo "Response: $response"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log_section "CLEANING UP TEST DATA"
    
    # Clean up in reverse dependency order
    if [ ! -z "$ACTIVITY_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-activities/$ACTIVITY_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted activity: $ACTIVITY_ID"
    fi
    
    if [ ! -z "$MEETING_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-meetings/$MEETING_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted meeting: $MEETING_ID"
    fi
    
    if [ ! -z "$TASK_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-tasks/$TASK_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted task: $TASK_ID"
    fi
    
    if [ ! -z "$DEAL_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-deals/$DEAL_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted deal: $DEAL_ID"
    fi
    
    if [ ! -z "$CONTACT_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-contacts/$CONTACT_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted contact: $CONTACT_ID"
    fi
    
    if [ ! -z "$COMPANY_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api-v1-companies/$COMPANY_ID" -H "X-API-Key: $API_KEY" > /dev/null
        log_info "Deleted company: $COMPANY_ID"
    fi
}

# Trap to ensure cleanup runs on exit
trap cleanup EXIT

# Integration test workflows
test_complete_sales_workflow() {
    log_section "COMPLETE SALES WORKFLOW INTEGRATION"
    
    # Step 1: Create Company
    log_test "Creating company for sales workflow"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Enterprise Corp\",
            \"website\": \"https://${TEST_PREFIX}.com\",
            \"industry\": \"Technology\",
            \"size\": \"100-500\",
            \"description\": \"A Fortune 500 technology company\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Company creation" "COMPANY_ID"
    
    # Step 2: Create Contact for the Company
    log_test "Creating primary contact for company"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"first_name\": \"John\",
            \"last_name\": \"Smith\",
            \"email\": \"john.smith@${TEST_PREFIX}.com\",
            \"phone\": \"+1-555-0123\",
            \"title\": \"VP of Technology\",
            \"is_primary\": true,
            \"company_id\": \"$COMPANY_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Contact creation with company link" "CONTACT_ID"
    
    # Step 3: Verify Company-Contact relationship
    log_test "Verifying company shows contact relationship"
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies/$COMPANY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status" -eq "200" ] && echo "$body" | grep -q "contact_count"; then
        log_pass "Company-contact relationship verified"
    else
        log_fail "Company-contact relationship not found"
    fi
    
    # Step 4: Create Deal linked to Company and Contact
    log_test "Creating deal with company and contact relationships"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Enterprise Software License\",
            \"company\": \"${TEST_PREFIX} Enterprise Corp\",
            \"value\": 150000,
            \"one_off_revenue\": 50000,
            \"monthly_mrr\": 5000,
            \"stage_id\": \"$STAGE_ID\",
            \"expected_close_date\": \"2025-03-15\",
            \"probability\": 75,
            \"priority\": \"high\",
            \"lead_source\": \"website\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Deal creation with financial calculations" "DEAL_ID"
    
    # Verify LTV calculation
    if [ ! -z "$DEAL_ID" ]; then
        expected_ltv=$((5000 * 3 + 50000))  # (MRR * 3) + One-off = 65000
        if echo "$body" | grep -q "\"ltv\":$expected_ltv"; then
            log_pass "Deal LTV calculation correct ($expected_ltv)"
        else
            log_fail "Deal LTV calculation incorrect"
        fi
    fi
    
    # Step 5: Create Task linked to Deal
    log_test "Creating task for deal follow-up"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"Follow up on ${TEST_PREFIX} proposal\",
            \"description\": \"Schedule technical demonstration and discuss pricing\",
            \"status\": \"todo\",
            \"priority\": \"high\",
            \"due_date\": \"2025-02-15T10:00:00Z\",
            \"deal_id\": \"$DEAL_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Task creation with deal linkage" "TASK_ID"
    
    # Step 6: Create Meeting for the Deal
    log_test "Creating meeting for deal discussion"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-meetings" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"${TEST_PREFIX} Technical Demo\",
            \"description\": \"Product demonstration and technical deep-dive\",
            \"meeting_type\": \"demo\",
            \"status\": \"scheduled\",
            \"start_time\": \"2025-02-20T14:00:00Z\",
            \"end_time\": \"2025-02-20T15:30:00Z\",
            \"duration_minutes\": 90,
            \"attendees\": [\"john.smith@${TEST_PREFIX}.com\", \"sales@ourcompany.com\"],
            \"location\": \"Zoom\",
            \"meeting_url\": \"https://zoom.us/j/123456789\",
            \"deal_id\": \"$DEAL_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Meeting creation with deal linkage" "MEETING_ID"
    
    # Step 7: Create Activity linked to Deal
    log_test "Creating sales activity for deal"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"call\",
            \"subject\": \"Discovery call with ${TEST_PREFIX}\",
            \"details\": \"Discussed requirements, timeline, and budget. Very positive response.\",
            \"amount\": 0,
            \"date\": \"2025-01-26T10:00:00Z\",
            \"status\": \"completed\",
            \"outcome\": \"positive\",
            \"deal_id\": \"$DEAL_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    test_response "$body" "$status" "201" "Activity creation with deal linkage" "ACTIVITY_ID"
    
    # Step 8: Verify all relationships work
    log_test "Verifying complete workflow relationships"
    
    all_relationships_work=true
    
    # Check deal has linked entities
    response=$(curl -s "$BASE_URL/api-v1-deals/$DEAL_ID" -H "X-API-Key: $API_KEY")
    if ! echo "$response" | grep -q "\"company\""; then
        all_relationships_work=false
    fi
    
    # Check company shows deal count
    response=$(curl -s "$BASE_URL/api-v1-companies/$COMPANY_ID" -H "X-API-Key: $API_KEY")
    if ! echo "$response" | grep -q "deal_count"; then
        all_relationships_work=false
    fi
    
    if [ "$all_relationships_work" = true ]; then
        log_pass "All workflow relationships verified"
    else
        log_fail "Some workflow relationships not working"
    fi
}

test_data_integrity_constraints() {
    log_section "DATA INTEGRITY AND CONSTRAINT TESTING"
    
    # Test 1: Cannot delete company with contacts
    if [ ! -z "$COMPANY_ID" ] && [ ! -z "$CONTACT_ID" ]; then
        log_test "Testing company deletion constraint (should fail)"
        
        response=$(curl -s -w "\n%{http_code}" \
            -X DELETE "$BASE_URL/api-v1-companies/$COMPANY_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "400" ] || [ "$status" -eq "409" ]; then
            log_pass "Company deletion properly prevented (has contacts)"
        else
            log_fail "Company deletion should fail when contacts exist"
        fi
    fi
    
    # Test 2: Test invalid foreign key references
    log_test "Testing invalid foreign key reference (should fail)"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "first_name": "Test",
            "last_name": "Contact",
            "email": "invalid@example.com",
            "company_id": "00000000-0000-0000-0000-000000000000"
        }')
    
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" -eq "400" ]; then
        log_pass "Invalid foreign key properly rejected"
    else
        log_fail "Invalid foreign key should be rejected"
    fi
    
    # Test 3: Test duplicate email constraint (if exists)
    if [ ! -z "$CONTACT_ID" ]; then
        log_test "Testing duplicate email constraint"
        
        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-contacts" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"first_name\": \"Duplicate\",
                \"last_name\": \"Contact\",
                \"email\": \"john.smith@${TEST_PREFIX}.com\",
                \"company_id\": \"$COMPANY_ID\"
            }")
        
        status=$(echo "$response" | tail -n1)
        
        # This might succeed or fail depending on if unique constraints exist
        if [ "$status" -eq "400" ] || [ "$status" -eq "409" ]; then
            log_pass "Duplicate email properly handled"
        elif [ "$status" -eq "201" ]; then
            log_info "Duplicate email allowed (no unique constraint)"
            # Clean up the duplicate
            body=$(echo "$response" | head -n -1)
            dup_id=$(extract_id "$body")
            curl -s -X DELETE "$BASE_URL/api-v1-contacts/$dup_id" -H "X-API-Key: $API_KEY" > /dev/null
        else
            log_fail "Unexpected response for duplicate email test"
        fi
    fi
}

test_business_logic_validation() {
    log_section "BUSINESS LOGIC VALIDATION TESTING"
    
    # Test 1: Deal financial calculations
    log_test "Testing deal financial calculations with various scenarios"
    
    # Create deal with only MRR
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"MRR Only Deal\",
            \"company\": \"Test Company\",
            \"value\": 24000,
            \"monthly_mrr\": 2000,
            \"stage_id\": \"$STAGE_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status" -eq "201" ]; then
        # LTV should be MRR * 3 = 6000
        if echo "$body" | grep -q '"ltv":6000'; then
            log_pass "MRR-only LTV calculation correct"
        else
            log_fail "MRR-only LTV calculation incorrect"
        fi
        
        # Clean up
        temp_deal_id=$(extract_id "$body")
        curl -s -X DELETE "$BASE_URL/api-v1-deals/$temp_deal_id" -H "X-API-Key: $API_KEY" > /dev/null
    else
        log_fail "MRR-only deal creation failed"
    fi
    
    # Test 2: Negative value validation
    log_test "Testing negative value validation (should fail)"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"Invalid Deal\",
            \"company\": \"Test Company\",
            \"value\": -1000,
            \"stage_id\": \"$STAGE_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" -eq "400" ]; then
        log_pass "Negative deal value properly rejected"
    else
        log_fail "Negative deal value should be rejected"
    fi
    
    # Test 3: Activity type validation
    log_test "Testing activity type validation"
    
    valid_types=("call" "email" "meeting" "task" "proposal" "sale" "note" "other")
    
    for activity_type in "${valid_types[@]}"; do
        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL/api-v1-activities" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"type\": \"$activity_type\",
                \"subject\": \"Test $activity_type\",
                \"date\": \"2025-01-26T10:00:00Z\"
            }")
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "201" ]; then
            # Clean up
            body=$(echo "$response" | head -n -1)
            temp_activity_id=$(extract_id "$body")
            curl -s -X DELETE "$BASE_URL/api-v1-activities/$temp_activity_id" -H "X-API-Key: $API_KEY" > /dev/null
        else
            log_fail "Valid activity type '$activity_type' was rejected"
            break
        fi
    done
    
    log_pass "All valid activity types accepted"
    
    # Test invalid activity type
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-activities" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "invalid_type",
            "subject": "Test Invalid Type",
            "date": "2025-01-26T10:00:00Z"
        }')
    
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" -eq "400" ]; then
        log_pass "Invalid activity type properly rejected"
    else
        log_fail "Invalid activity type should be rejected"
    fi
}

test_filtering_and_search() {
    log_section "FILTERING AND SEARCH FUNCTIONALITY"
    
    # Test 1: Search across entities
    log_test "Testing cross-entity search functionality"
    
    search_term="$TEST_PREFIX"
    
    # Search companies
    response=$(curl -s "$BASE_URL/api-v1-companies?search=$search_term" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q "\"count\":[1-9]"; then
        log_pass "Company search returns results"
    else
        log_fail "Company search should return results"
    fi
    
    # Search contacts  
    response=$(curl -s "$BASE_URL/api-v1-contacts?search=john.smith" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q "\"count\":[1-9]"; then
        log_pass "Contact search returns results"
    else
        log_fail "Contact search should return results"
    fi
    
    # Search deals
    response=$(curl -s "$BASE_URL/api-v1-deals?search=$search_term" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q "\"count\":[1-9]"; then
        log_pass "Deal search returns results"
    else
        log_fail "Deal search should return results"
    fi
    
    # Test 2: Date filtering
    log_test "Testing date range filtering"
    
    today=$(date -u +"%Y-%m-%d")
    tomorrow=$(date -u -v +1d +"%Y-%m-%d" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%d")
    
    response=$(curl -s "$BASE_URL/api-v1-activities?date_from=${today}&date_to=${tomorrow}" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q '"data"'; then
        log_pass "Date range filtering works"
    else
        log_fail "Date range filtering failed"
    fi
    
    # Test 3: Status filtering
    log_test "Testing status filtering"
    
    response=$(curl -s "$BASE_URL/api-v1-tasks?status=todo" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q '"data"'; then
        log_pass "Status filtering works"
    else
        log_fail "Status filtering failed"
    fi
    
    # Test 4: Pagination
    log_test "Testing pagination functionality"
    
    response=$(curl -s "$BASE_URL/api-v1-activities?limit=1&offset=0" -H "X-API-Key: $API_KEY")
    if echo "$response" | grep -q '"pagination"'; then
        log_pass "Pagination metadata present"
    else
        log_fail "Pagination metadata missing"
    fi
}

test_workflow_state_changes() {
    log_section "WORKFLOW STATE CHANGE TESTING"
    
    if [ ! -z "$TASK_ID" ]; then
        log_test "Testing task status transitions"
        
        # Update task to in_progress
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-tasks/$TASK_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"status": "in_progress"}')
        
        status=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$status" -eq "200" ] && echo "$body" | grep -q "in_progress"; then
            log_pass "Task status transition to in_progress"
        else
            log_fail "Task status transition failed"
        fi
        
        # Complete the task
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-tasks/$TASK_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"status": "completed"}')
        
        status=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$status" -eq "200" ] && echo "$body" | grep -q "completed"; then
            log_pass "Task completion workflow"
        else
            log_fail "Task completion failed"
        fi
    fi
    
    if [ ! -z "$MEETING_ID" ]; then
        log_test "Testing meeting status transitions"
        
        # Start meeting
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-meetings/$MEETING_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"status": "in_progress"}')
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "200" ]; then
            log_pass "Meeting status transition to in_progress"
        else
            log_fail "Meeting status transition failed"
        fi
        
        # Complete meeting
        response=$(curl -s -w "\n%{http_code}" \
            -X PUT "$BASE_URL/api-v1-meetings/$MEETING_ID" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"status": "completed"}')
        
        status=$(echo "$response" | tail -n1)
        
        if [ "$status" -eq "200" ]; then
            log_pass "Meeting completion workflow"
        else
            log_fail "Meeting completion failed"
        fi
    fi
}

# Generate final report
generate_integration_report() {
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    log_section "INTEGRATION TEST REPORT"
    
    echo -e "${BLUE}Total Integration Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed Tests:${NC} $PASSED_TESTS"  
    echo -e "${RED}Failed Tests:${NC} $FAILED_TESTS"
    echo -e "${BLUE}Success Rate:${NC} ${success_rate}%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ ALL INTEGRATION TESTS PASSED${NC}"
        echo ""
        echo -e "${BLUE}Integration Coverage:${NC}"
        echo "  ✓ Complete sales workflow (company → contact → deal → task → meeting → activity)"
        echo "  ✓ Data integrity and foreign key constraints"
        echo "  ✓ Business logic validation (financial calculations, value constraints)"
        echo "  ✓ Cross-entity search and filtering"
        echo "  ✓ Workflow state transitions"
        echo "  ✓ Relationship verification and data consistency"
    else
        echo -e "${YELLOW}⚠️  SOME INTEGRATION TESTS FAILED${NC}"
        echo "Review the failed tests above for issues with:"
        echo "  - Entity relationships and foreign key constraints"
        echo "  - Business logic validation"
        echo "  - Data integrity enforcement"
        echo "  - Workflow state management"
    fi
}

# Main execution function
main() {
    log_section "CRM API INTEGRATION TEST SUITE"
    
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
    echo -e "${BLUE}API Key:${NC} ${API_KEY:0:10}..."
    echo -e "${BLUE}Test Prefix:${NC} $TEST_PREFIX"
    echo ""
    
    # Check if API key is set
    if [ "$API_KEY" = "your_api_key_here" ]; then
        log_fail "Please set API_KEY environment variable"
        exit 1
    fi
    
    # Run integration test suites
    test_complete_sales_workflow
    test_data_integrity_constraints
    test_business_logic_validation
    test_filtering_and_search
    test_workflow_state_changes
    
    # Generate final report
    generate_integration_report
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "CRM API Integration Test Suite"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h         Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  API_KEY           CRM API key (required)"
        echo ""
        echo "Tests Covered:"
        echo "  - Complete sales workflow integration"
        echo "  - Data integrity and constraint validation"  
        echo "  - Business logic and financial calculations"
        echo "  - Cross-entity search and filtering"
        echo "  - Workflow state transitions"
        echo ""
        echo "Example:"
        echo "  export API_KEY=sk_your_api_key_here"
        echo "  $0"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac