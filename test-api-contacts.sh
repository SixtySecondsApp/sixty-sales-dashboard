#!/bin/bash

# Comprehensive Contacts API Test Script
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
TEST_PREFIX="test-contact-$(date +%s)"

# Global variables
CREATED_CONTACT_ID=""
CREATED_COMPANY_ID=""
TEST_EMAIL="${TEST_PREFIX}@example.com"

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
        "$BASE_URL/api-v1-contacts")
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "401" "Missing API key should return 401"
    
    # Test invalid API key
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: invalid_key")
    status=$(echo "$response" | tail -n1)
    
    assert_status "$status" "401" "Invalid API key should return 401"
}

test_create_contact() {
    log_test "Testing Contact Creation"
    
    # First create a company for testing
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
        log_info "Created test company: $CREATED_COMPANY_ID"
    fi
    
    # Test successful contact creation
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"first_name\": \"John\",
            \"last_name\": \"Doe\",
            \"email\": \"$TEST_EMAIL\",
            \"phone\": \"+1-555-0123\",
            \"title\": \"CEO\",
            \"linkedin_url\": \"https://linkedin.com/in/johndoe\",
            \"company_id\": \"$CREATED_COMPANY_ID\"
        }")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "201" "Contact creation should return 201"
    assert_response "$body" "John" "Response should contain first name"
    assert_response "$body" "$TEST_EMAIL" "Response should contain email"
    
    # Extract contact ID for further tests
    CREATED_CONTACT_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
    log_info "Created contact ID: $CREATED_CONTACT_ID"
    
    # Test validation errors
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"last_name": "Incomplete"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Missing required fields should return 400"
    
    # Test invalid email format
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"first_name": "Test", "email": "invalid-email"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid email format should return 400"
}

test_get_contacts() {
    log_test "Testing Contact Retrieval"
    
    # Test list contacts
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "List contacts should return 200"
    assert_response "$body" '"data"' "Response should contain data array"
    
    # Test pagination
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts?limit=5&offset=0" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Pagination should work"
    
    # Test search functionality
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts?search=John" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Search should work"
}

test_get_single_contact() {
    log_test "Testing Single Contact Retrieval"
    
    if [ -z "$CREATED_CONTACT_ID" ]; then
        log_fail "Cannot test single contact - no contact ID available"
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Get single contact should return 200"
    assert_response "$body" "$CREATED_CONTACT_ID" "Response should contain contact ID"
    assert_response "$body" "$TEST_EMAIL" "Response should contain test email"
    
    # Test non-existent contact
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Non-existent contact should return 404"
}

test_update_contact() {
    log_test "Testing Contact Updates"
    
    if [ -z "$CREATED_CONTACT_ID" ]; then
        log_fail "Cannot test update - no contact ID available"
        return 1
    fi
    
    # Test successful update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "first_name": "Jane",
            "last_name": "Updated",
            "title": "CTO"
        }')
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    assert_status "$status" "200" "Contact update should return 200"
    assert_response "$body" "Jane" "Updated contact should contain new first name"
    assert_response "$body" "CTO" "Updated contact should contain new title"
    
    # Test validation on update
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"email": "invalid-email"}')
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "400" "Invalid email on update should return 400"
}

test_contact_filtering() {
    log_test "Testing Contact Filtering"
    
    # Test company_id filter
    if [ ! -z "$CREATED_COMPANY_ID" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            "$BASE_URL/api-v1-contacts?company_id=$CREATED_COMPANY_ID" \
            -H "X-API-Key: $API_KEY")
        
        status=$(echo "$response" | tail -n1)
        assert_status "$status" "200" "Company ID filter should work"
    fi
    
    # Test is_primary filter
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts?is_primary=true" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Primary contact filter should work"
    
    # Test sorting
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts?sort=first_name&order=asc" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Sorting should work"
}

test_delete_contact() {
    log_test "Testing Contact Deletion"
    
    if [ -z "$CREATED_CONTACT_ID" ]; then
        log_fail "Cannot test deletion - no contact ID available"
        return 1
    fi
    
    # Test successful deletion
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "200" "Contact deletion should return 200"
    
    # Verify contact is deleted
    response=$(curl -s -w "\n%{http_code}" \
        "$BASE_URL/api-v1-contacts/$CREATED_CONTACT_ID" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Deleted contact should return 404"
    
    # Clear the ID so cleanup doesn't try to delete again
    CREATED_CONTACT_ID=""
    
    # Test deleting non-existent contact
    response=$(curl -s -w "\n%{http_code}" \
        -X DELETE "$BASE_URL/api-v1-contacts/00000000-0000-0000-0000-000000000000" \
        -H "X-API-Key: $API_KEY")
    
    status=$(echo "$response" | tail -n1)
    assert_status "$status" "404" "Delete non-existent contact should return 404"
}

test_rate_limiting() {
    log_test "Testing Rate Limiting Headers"
    
    response=$(curl -s -w "\n%{http_code}" \
        -I "$BASE_URL/api-v1-contacts" \
        -H "X-API-Key: $API_KEY")
    
    headers=$(echo "$response" | head -n -1)
    
    if echo "$headers" | grep -q "X-RateLimit-Limit"; then
        log_pass "Rate limit headers present"
    else
        log_fail "Rate limit headers missing"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "    CONTACTS API COMPREHENSIVE TESTS     "
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
    
    test_create_contact
    echo ""
    
    test_get_contacts
    echo ""
    
    test_get_single_contact
    echo ""
    
    test_update_contact
    echo ""
    
    test_contact_filtering
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_delete_contact
    echo ""
    
    echo "=========================================="
    echo "           TESTS COMPLETED               "
    echo "=========================================="
}

# Run main function
main "$@"