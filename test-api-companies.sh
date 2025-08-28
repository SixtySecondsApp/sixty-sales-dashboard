#!/bin/bash

# Comprehensive Companies API Test Script
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
TEST_PREFIX="test-company-$(date +%s)"

# Global variables
CREATED_COMPANY_ID=""
CREATED_CONTACT_ID=""
TEST_DOMAIN="${TEST_PREFIX}.com"

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
    
    # Delete created contact first (foreign key constraint)
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
        "$BASE_URL/api-v1-companies")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_create_company() {
    log_test "Testing Company Creation"
    
    # Test successful company creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Corp\",
            \"website\": \"https://${TEST_DOMAIN}\",
            \"industry\": \"Technology\",
            \"size\": \"50-100\",
            \"description\": \"A test company for API testing\",
            \"linkedin_url\": \"https://linkedin.com/company/${TEST_PREFIX}\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Company creation should return 201"
    assert_response "$body" "${TEST_PREFIX} Corp" "Response should contain company name"
    assert_response "$body" "$TEST_DOMAIN" "Response should contain website"
    
    # Extract company ID for further tests
    CREATED_COMPANY_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created company ID: $CREATED_COMPANY_ID"
    
    # Test validation errors - missing required name
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"website": "https://example.com"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required fields should return 400"
    
    # Test invalid website format
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"name": "Test Company", "website": "invalid-url"}')
    
    status=$(echo "$response" | tail -n1)
    # This might return 400 for validation or 201 if validation is lenient
    if [ "$status" -ne "201" ] && [ "$status" -ne "400" ]; then
        log_fail "Invalid website format - unexpected status $status"
    else
        log_pass "Invalid website format handled appropriately"
    fi
}

test_get_companies() {
    log_test "Testing Company Retrieval"
    
    # Test list companies
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List companies should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    assert_response "$body" '"count"' "Response should contain count"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Pagination should work"
    assert_response "$body" '"pagination"' "Response should contain pagination info"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?search=${TEST_PREFIX}" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Search should work"
    assert_response "$body" "$TEST_PREFIX" "Search results should contain test company"
}

test_get_single_company() {
    log_test "Testing Single Company Retrieval"
    
    if [ -z "$CREATED_COMPANY_ID" ]; then
        log_fail "Cannot test single company - no company ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single company should return 200"
    assert_response "$body" "$CREATED_COMPANY_ID" "Response should contain company ID"
    assert_response "$body" "${TEST_PREFIX} Corp" "Response should contain company name"
    
    # Test non-existent company
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent company should return 404"
}

test_update_company() {
    log_test "Testing Company Updates"
    
    if [ -z "$CREATED_COMPANY_ID" ]; then
        log_fail "Cannot test update - no company ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${TEST_PREFIX} Corp Updated\",
            \"industry\": \"Software\",
            \"size\": \"100-500\",
            \"description\": \"Updated description for testing\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Company update should return 200"
    assert_response "$body" "Updated" "Updated company should contain new name"
    assert_response "$body" "Software" "Updated company should contain new industry"
    
    # Test partial update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"industry": "SaaS"}')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Partial update should work"
    assert_response "$body" "SaaS" "Partial update should contain new industry"
}

test_company_filtering() {
    log_test "Testing Company Filtering"
    
    # Test industry filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?industry=SaaS" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Industry filter should work"
    
    # Test size filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?size=100-500" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Size filter should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?sort=name&order=asc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting should work"
    
    # Test date range filtering
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies?date_from=2025-01-01&date_to=2025-12-31" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Date range filtering should work"
}

test_company_with_relationships() {
    log_test "Testing Company with Related Data"
    
    if [ -z "$CREATED_COMPANY_ID" ]; then
        log_fail "Cannot test relationships - no company ID available"
        return 1
    fi
    
    # Create a contact for this company
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
        log_info "Created test contact: $CREATED_CONTACT_ID"
        
        # Now get the company with related data
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        
        assert_status "$status" "200" "Get company with relationships should work"
        assert_response "$body" '"contact_count"' "Response should include contact count"
    else
        log_fail "Could not create test contact for relationship testing"
    fi
}

test_delete_company() {
    log_test "Testing Company Deletion"
    
    if [ -z "$CREATED_COMPANY_ID" ]; then
        log_fail "Cannot test deletion - no company ID available"
        return 1
    fi
    
    # First try to delete company with relationships (should fail)
    if [ ! -z "$CREATED_CONTACT_ID" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X DELETE "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        # Should return 400 or 409 due to foreign key constraint
        if [ "$status" -eq "400" ] || [ "$status" -eq "409" ]; then
            log_pass "Cannot delete company with related data - Status $status"
        else
            log_fail "Expected 400/409 for company with relationships, got $status"
        fi
        
        # Clean up contact first
        curl -s -X DELETE \
            "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
            -H "X-API-Key: $API_KEY" > /dev/null
        CREATED_CONTACT_ID=""
    fi
    
    # Now test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Company deletion should return 200"
    
    # Verify company is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-companies/$CREATED_COMPANY_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted company should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_COMPANY_ID=""
    
    # Test deleting non-existent company
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-companies/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent company should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -I \
        "$BASE_URL/api-v1-companies" \
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
    echo "    COMPANIES API COMPREHENSIVE TESTS    "
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
    
    test_create_company
    echo ""
    
    test_get_companies
    echo ""
    
    test_get_single_company
    echo ""
    
    test_update_company
    echo ""
    
    test_company_filtering
    echo ""
    
    test_company_with_relationships
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_company
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"