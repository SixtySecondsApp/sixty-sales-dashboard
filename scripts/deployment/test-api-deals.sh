#!/bin/bash

# Comprehensive Deals API Test Script
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
TEST_PREFIX="test-deal-$(date +%s)"

# Global variables
CREATED_DEAL_ID=""
CREATED_COMPANY_ID=""
CREATED_CONTACT_ID=""
STAGE_ID=""

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

# Get a valid stage ID for testing
get_stage_id() {
    log_info "Getting valid stage ID for testing..."
    
    # Try to get stages from the API (if stages endpoint exists)
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/stages" \
        -H "X-API-Key: $API_KEY" 2>/dev/null || echo -e "\n404")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status" -eq "200" ]; then
        STAGE_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
        if [ ! -z "$STAGE_ID" ]; then
            log_info "Found stage ID: $STAGE_ID"
            return 0
        fi
    fi
    
    # Fallback: use a common UUID format for testing
    STAGE_ID="00000000-0000-0000-0000-000000000001"
    log_info "Using fallback stage ID: $STAGE_ID"
}

# Test functions
test_api_authentication() {
    log_test "Testing API Authentication"
    
    # Test missing API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_setup_prerequisites() {
    log_test "Setting Up Prerequisites (Company and Contact)"
    
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
        log_fail "Failed to create test company"
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
            log_fail "Failed to create test contact"
        fi
    fi
    
    # Get a valid stage ID
    get_stage_id
}

test_create_deal() {
    log_test "Testing Deal Creation"
    
    # Test successful deal creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Enterprise Deal\",
            \"company\": \"${TEST_PREFIX} Company\",
            \"value\": 50000,
            \"one_off_revenue\": 10000,
            \"monthly_mrr\": 2000,
            \"stage_id\": \"$STAGE_ID\",
            \"expected_close_date\": \"2025-03-01\",
            \"probability\": 75,
            \"priority\": \"high\",
            \"lead_source\": \"referral\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Deal creation should return 201"
    assert_response "$body" "${TEST_PREFIX} Enterprise Deal" "Response should contain deal name"
    assert_response "$body" "50000" "Response should contain deal value"
    
    # Extract deal ID for further tests
    CREATED_DEAL_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created deal ID: $CREATED_DEAL_ID"
    
    # Test validation errors - missing required name
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"company": "Test Co", "value": 1000}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required fields should return 400"
    
    # Test negative value validation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"Test Deal\", \"value\": -1000, \"stage_id\": \"$STAGE_ID\"}")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Negative value should return 400"
    
    # Test invalid stage_id
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"name": "Test Deal", "value": 1000, "stage_id": "invalid-uuid"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid stage_id should return 400"
}

test_get_deals() {
    log_test "Testing Deal Retrieval"
    
    # Test list deals
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List deals should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    assert_response "$body" '"count"' "Response should contain count"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Pagination should work"
    assert_response "$body" '"pagination"' "Response should contain pagination info"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?search=${TEST_PREFIX}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Search should work"
    if [ ! -z "$CREATED_DEAL_ID" ]; then
        assert_response "$body" "$TEST_PREFIX" "Search results should contain test deal"
    fi
}

test_get_single_deal() {
    log_test "Testing Single Deal Retrieval"
    
    if [ -z "$CREATED_DEAL_ID" ]; then
        log_fail "Cannot test single deal - no deal ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single deal should return 200"
    assert_response "$body" "$CREATED_DEAL_ID" "Response should contain deal ID"
    assert_response "$body" "${TEST_PREFIX} Enterprise Deal" "Response should contain deal name"
    assert_response "$body" '"ltv"' "Response should include calculated LTV"
    assert_response "$body" '"annual_value"' "Response should include annual value"
    
    # Test non-existent deal
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent deal should return 404"
}

test_update_deal() {
    log_test "Testing Deal Updates"
    
    if [ -z "$CREATED_DEAL_ID" ]; then
        log_fail "Cannot test update - no deal ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Updated Deal\",
            \"value\": 75000,
            \"probability\": 85,
            \"priority\": \"urgent\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Deal update should return 200"
    assert_response "$body" "Updated Deal" "Updated deal should contain new name"
    assert_response "$body" "75000" "Updated deal should contain new value"
    assert_response "$body" "85" "Updated deal should contain new probability"
    
    # Test partial update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"probability": 90}')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Partial update should work"
    assert_response "$body" "90" "Partial update should contain new probability"
    
    # Test validation on update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"value": -5000}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid value on update should return 400"
}

test_deal_filtering() {
    log_test "Testing Deal Filtering"
    
    # Test stage_id filter
    if [ ! -z "$STAGE_ID" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/api-v1-deals?stage_id=$STAGE_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        assert_status "$status" "200" "Stage ID filter should work"
    fi
    
    # Test value range filters
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?min_value=10000&max_value=100000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Value range filter should work"
    
    # Test priority filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?priority=urgent" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Priority filter should work"
    
    # Test status filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?status=open" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Status filter should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?sort=value&order=desc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting by value should work"
    
    # Test date range filtering
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals?date_from=2025-01-01&date_to=2025-12-31" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Date range filtering should work"
}

test_deal_financial_calculations() {
    log_test "Testing Deal Financial Calculations"
    
    if [ -z "$CREATED_DEAL_ID" ]; then
        log_fail "Cannot test calculations - no deal ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status" -eq "200" ]; then
        # Check if financial calculations are present
        assert_response "$body" '"ltv"' "Response should include LTV calculation"
        assert_response "$body" '"annual_value"' "Response should include annual value"
        
        # Extract values and verify LTV calculation (MRR × 3 + One-off)
        # Note: This is a simplified check - in real testing you'd parse JSON properly
        if echo "$body" | grep -q '"monthly_mrr":2000' && echo "$body" | grep -q '"one_off_revenue":10000'; then
            # Expected LTV = (2000 × 3) + 10000 = 16000
            if echo "$body" | grep -q '"ltv":16000'; then
                log_pass "LTV calculation is correct (MRR × 3 + One-off)"
            else
                log_fail "LTV calculation appears incorrect"
            fi
        fi
    else
        log_fail "Could not retrieve deal for financial calculations test"
    fi
}

test_deal_permissions() {
    log_test "Testing Deal Permission Rules"
    
    # Note: This test assumes the API implements permission checks
    # In a real implementation, you'd test with different user contexts
    
    log_info "Permission tests require different user contexts - skipping for now"
    log_info "In full implementation, test:"
    log_info "  - Non-admins can only edit their own deals"
    log_info "  - Deals with revenue splits can only be modified by admins"
    log_info "  - Non-admins can only delete their own non-split deals"
}

test_delete_deal() {
    log_test "Testing Deal Deletion"
    
    if [ -z "$CREATED_DEAL_ID" ]; then
        log_fail "Cannot test deletion - no deal ID available"
        return 1
    fi
    
    # Test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Deal deletion should return 200"
    
    # Verify deal is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-deals/$CREATED_DEAL_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted deal should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_DEAL_ID=""
    
    # Test deleting non-existent deal
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-deals/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent deal should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -I \
        "$BASE_URL/api-v1-deals" \
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
    echo "     DEALS API COMPREHENSIVE TESTS       "
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
    
    test_create_deal
    echo ""
    
    test_get_deals
    echo ""
    
    test_get_single_deal
    echo ""
    
    test_update_deal
    echo ""
    
    test_deal_filtering
    echo ""
    
    test_deal_financial_calculations
    echo ""
    
    test_deal_permissions
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_deal
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"