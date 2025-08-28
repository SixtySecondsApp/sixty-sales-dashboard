#!/bin/bash

# Complete CRM API Test Suite
# Runs all individual API test scripts in sequence with comprehensive reporting

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1"
API_KEY=${API_KEY:-"your_api_key_here"}
TEST_SUITE_START=$(date +%s)

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
TEST_RESULTS=()

# Utility functions
log_suite() {
    echo -e "${CYAN}[SUITE]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED_TESTS++))
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

# Function to run individual test script
run_test_script() {
    local script_name="$1"
    local entity_name="$2"
    
    log_suite "Running $entity_name API tests..."
    
    if [ ! -f "$script_name" ]; then
        log_fail "$entity_name test script not found: $script_name"
        TEST_RESULTS+=("$entity_name: FAILED - Script not found")
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_name"
    
    # Run the test script and capture output
    local start_time=$(date +%s)
    local output_file="/tmp/test-output-$(basename $script_name .sh).log"
    
    if ./"$script_name" > "$output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_pass "$entity_name tests completed in ${duration}s"
        TEST_RESULTS+=("$entity_name: PASSED (${duration}s)")
        
        # Show summary from the test output
        local test_count=$(grep -c "\[PASS\]\|\[FAIL\]" "$output_file")
        local pass_count=$(grep -c "\[PASS\]" "$output_file")
        local fail_count=$(grep -c "\[FAIL\]" "$output_file")
        
        log_info "$entity_name summary: $pass_count passed, $fail_count failed out of $test_count tests"
        
        TOTAL_TESTS=$((TOTAL_TESTS + test_count))
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_fail "$entity_name tests failed in ${duration}s"
        TEST_RESULTS+=("$entity_name: FAILED (${duration}s)")
        
        # Show last few lines of output for debugging
        echo "Last 10 lines of output:"
        tail -n 10 "$output_file" | sed 's/^/  /'
        
        return 1
    fi
}

# Function to check API connectivity
test_api_connectivity() {
    log_suite "Testing API connectivity..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -m 10 \
        "$BASE_URL/health" \
        -H "X-API-Key: $API_KEY" 2>/dev/null || echo -e "\n000")
    
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" -eq "200" ]; then
        log_pass "API connectivity test passed"
        return 0
    else
        log_fail "API connectivity test failed (Status: $status)"
        log_info "Base URL: $BASE_URL"
        log_info "API Key: ${API_KEY:0:10}..."
        return 1
    fi
}

# Function to validate environment
validate_environment() {
    log_suite "Validating test environment..."
    
    # Check if API key is set
    if [ "$API_KEY" = "your_api_key_here" ]; then
        log_fail "API_KEY environment variable not set"
        echo "Please set API_KEY environment variable:"
        echo "  export API_KEY=your_actual_api_key"
        return 1
    fi
    
    log_pass "API key is set"
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_fail "curl is not installed"
        return 1
    fi
    
    log_pass "curl is available"
    
    # Check if required test scripts exist
    local scripts=(
        "test-api-contacts.sh"
        "test-api-companies.sh"
        "test-api-deals.sh"
        "test-api-tasks.sh"
        "test-api-meetings.sh"
        "test-api-activities.sh"
    )
    
    local missing_scripts=0
    for script in "${scripts[@]}"; do
        if [ ! -f "$script" ]; then
            log_fail "Missing test script: $script"
            ((missing_scripts++))
        fi
    done
    
    if [ $missing_scripts -eq 0 ]; then
        log_pass "All test scripts are present"
    else
        log_fail "$missing_scripts test scripts are missing"
        return 1
    fi
    
    return 0
}

# Function to run integration tests
run_integration_tests() {
    log_suite "Running integration tests..."
    
    if [ -f "test-api-integration.sh" ]; then
        chmod +x test-api-integration.sh
        if ./test-api-integration.sh; then
            log_pass "Integration tests passed"
            TEST_RESULTS+=("Integration: PASSED")
        else
            log_fail "Integration tests failed"
            TEST_RESULTS+=("Integration: FAILED")
        fi
    else
        log_skip "Integration tests not found (test-api-integration.sh)"
        TEST_RESULTS+=("Integration: SKIPPED - Script not found")
    fi
}

# Function to generate final report
generate_report() {
    local suite_end=$(date +%s)
    local total_duration=$((suite_end - TEST_SUITE_START))
    local hours=$((total_duration / 3600))
    local minutes=$(((total_duration % 3600) / 60))
    local seconds=$((total_duration % 60))
    
    log_section "COMPLETE TEST SUITE REPORT"
    
    echo -e "${BLUE}Test Suite Duration:${NC} ${hours}h ${minutes}m ${seconds}s"
    echo -e "${BLUE}Total Tests Executed:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed Tests:${NC} $PASSED_TESTS"
    echo -e "${RED}Failed Tests:${NC} $FAILED_TESTS"
    echo -e "${YELLOW}Skipped Tests:${NC} $SKIPPED_TESTS"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
        local success_rate=100
    else
        local success_rate=$((PASSED_TESTS * 100 / (PASSED_TESTS + FAILED_TESTS)))
        echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
        echo -e "${BLUE}Success Rate:${NC} ${success_rate}%"
    fi
    
    echo ""
    echo -e "${BLUE}Individual Test Results:${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    echo ""
    echo -e "${BLUE}API Endpoints Tested:${NC}"
    echo "  ✓ Contacts API (CRUD, filtering, validation)"
    echo "  ✓ Companies API (CRUD, relationships, constraints)"  
    echo "  ✓ Deals API (CRUD, financial calculations, permissions)"
    echo "  ✓ Tasks API (CRUD, status transitions, filtering)"
    echo "  ✓ Meetings API (CRUD, webhooks, types/statuses)"
    echo "  ✓ Activities API (CRUD, types/outcomes, revenue tracking)"
    
    echo ""
    echo -e "${BLUE}Test Coverage:${NC}"
    echo "  ✓ Authentication (API keys, unauthorized access)"
    echo "  ✓ CRUD Operations (Create, Read, Update, Delete)"
    echo "  ✓ Data Validation (required fields, formats, constraints)"
    echo "  ✓ Error Handling (404, 400, validation errors)"
    echo "  ✓ Filtering & Pagination (query parameters, sorting)"
    echo "  ✓ Rate Limiting (headers, limits)"
    echo "  ✓ Business Logic (financial calculations, relationships)"
    echo "  ✓ Webhook Integration (meetings webhook functionality)"
    
    # Save report to file
    local report_file="test-results-$(date +%Y%m%d-%H%M%S).txt"
    {
        echo "CRM API Test Suite Report - $(date)"
        echo "========================================"
        echo ""
        echo "Duration: ${hours}h ${minutes}m ${seconds}s"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        echo "Skipped: $SKIPPED_TESTS"
        echo "Success Rate: ${success_rate}%"
        echo ""
        echo "Individual Results:"
        for result in "${TEST_RESULTS[@]}"; do
            echo "  $result"
        done
    } > "$report_file"
    
    log_info "Detailed report saved to: $report_file"
}

# Main execution function
main() {
    log_section "CRM API COMPREHENSIVE TEST SUITE"
    
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
    echo -e "${BLUE}API Key:${NC} ${API_KEY:0:10}..."
    echo -e "${BLUE}Start Time:${NC} $(date)"
    echo ""
    
    # Validate environment
    if ! validate_environment; then
        log_fail "Environment validation failed. Exiting."
        exit 1
    fi
    echo ""
    
    # Test API connectivity
    if ! test_api_connectivity; then
        log_fail "API connectivity test failed. Continuing with caution..."
    fi
    echo ""
    
    # Run individual entity tests
    log_section "ENTITY API TESTS"
    
    # Test order matters - companies before contacts, deals after companies/contacts
    run_test_script "test-api-companies.sh" "Companies"
    echo ""
    
    run_test_script "test-api-contacts.sh" "Contacts" 
    echo ""
    
    run_test_script "test-api-deals.sh" "Deals"
    echo ""
    
    run_test_script "test-api-tasks.sh" "Tasks"
    echo ""
    
    run_test_script "test-api-meetings.sh" "Meetings"
    echo ""
    
    run_test_script "test-api-activities.sh" "Activities"
    echo ""
    
    # Run integration tests
    log_section "INTEGRATION TESTS"
    run_integration_tests
    echo ""
    
    # Generate final report
    generate_report
    
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
        echo "CRM API Complete Test Suite"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h         Show this help message"
        echo "  --connectivity     Test API connectivity only"
        echo "  --validate         Validate environment only"
        echo ""
        echo "Environment Variables:"
        echo "  API_KEY           CRM API key (required)"
        echo ""
        echo "Examples:"
        echo "  export API_KEY=sk_your_api_key_here"
        echo "  $0"
        echo ""
        exit 0
        ;;
    --connectivity)
        validate_environment && test_api_connectivity
        exit $?
        ;;
    --validate)
        validate_environment
        exit $?
        ;;
    *)
        main "$@"
        ;;
esac