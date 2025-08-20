#!/bin/bash

# Contact API Fix Test Runner Script
# This script runs all tests related to the contact API fix and generates reports

set -e

echo "🧪 Contact API Fix Test Suite Runner"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "vite.config.ts" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    npm install
fi

# Function to check if backend server is running
check_backend_server() {
    print_info "Checking if backend server is running on port 8000..."
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        print_status "Backend server is running"
        return 0
    else
        print_warning "Backend server is not running on port 8000"
        return 1
    fi
}

# Function to run test suite
run_test_suite() {
    local test_name=$1
    local test_path=$2
    local description=$3
    
    echo ""
    print_info "Running $test_name tests..."
    echo "Description: $description"
    
    if npm test "$test_path" --run --reporter=verbose; then
        print_status "$test_name tests passed"
        return 0
    else
        print_error "$test_name tests failed"
        return 1
    fi
}

# Function to run tests with coverage
run_with_coverage() {
    local test_path=$1
    
    print_info "Running tests with coverage..."
    if npm run test:coverage "$test_path" --run; then
        print_status "Coverage report generated"
        return 0
    else
        print_error "Coverage generation failed"
        return 1
    fi
}

# Parse command line arguments
COVERAGE=false
INTEGRATION=false
WATCH=false
SPECIFIC_TEST=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --integration|-i)
            INTEGRATION=true
            shift
            ;;
        --watch|-w)
            WATCH=true
            shift
            ;;
        --test|-t)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --coverage, -c     Run tests with coverage report"
            echo "  --integration, -i  Run integration tests (requires backend server)"
            echo "  --watch, -w        Run tests in watch mode"
            echo "  --test, -t TEST    Run specific test file"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Run all contact API fix tests"
            echo "  $0 --coverage                        # Run with coverage"
            echo "  $0 --integration                     # Run integration tests"
            echo "  $0 --test ContactSearchModal         # Run specific test"
            echo "  $0 --watch                           # Run in watch mode"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create test results directory
mkdir -p test-results

echo ""
print_info "Starting Contact API Fix Test Suite"
echo "Coverage: $COVERAGE"
echo "Integration: $INTEGRATION"
echo "Watch mode: $WATCH"
echo "Specific test: ${SPECIFIC_TEST:-'All tests'}"

# If specific test is requested
if [ -n "$SPECIFIC_TEST" ]; then
    print_info "Running specific test: $SPECIFIC_TEST"
    
    # Map test names to file paths
    case $SPECIFIC_TEST in
        "ContactSearchModal"|"contact-search")
            TEST_FILE="src/tests/contact-api-fix/ContactSearchModal.test.tsx"
            ;;
        "QuickAdd"|"quickadd"|"quick-add")
            TEST_FILE="src/tests/contact-api-fix/QuickAddContactFlow.test.tsx"
            ;;
        "Integration"|"integration"|"deal-creation")
            TEST_FILE="src/tests/contact-api-fix/DealCreationIntegration.test.tsx"
            ;;
        "ErrorHandling"|"error-handling"|"errors")
            TEST_FILE="src/tests/contact-api-fix/ApiErrorHandling.test.tsx"
            ;;
        "Proxy"|"proxy"|"api-proxy")
            TEST_FILE="src/tests/contact-api-fix/ApiProxyValidation.test.tsx"
            ;;
        *)
            # Assume it's a file path
            TEST_FILE="$SPECIFIC_TEST"
            ;;
    esac
    
    if [ "$WATCH" = true ]; then
        print_info "Running $TEST_FILE in watch mode..."
        npm test "$TEST_FILE" --watch
    else
        npm test "$TEST_FILE" --run --reporter=verbose
    fi
    exit $?
fi

# Run all tests if watch mode is requested
if [ "$WATCH" = true ]; then
    print_info "Running all contact API fix tests in watch mode..."
    npm test "src/tests/contact-api-fix/" --watch
    exit 0
fi

# Test execution starts here
FAILED_TESTS=0

echo ""
echo "🚀 Beginning Test Execution"
echo "=========================="

# 1. ContactSearchModal Tests
if ! run_test_suite "ContactSearchModal" "src/tests/contact-api-fix/ContactSearchModal.test.tsx" "Tests contact search functionality and API proxy integration"; then
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 2. QuickAdd Integration Tests
if ! run_test_suite "QuickAdd Integration" "src/tests/contact-api-fix/QuickAddContactFlow.test.tsx" "Tests contact integration in proposal, sale, and meeting workflows"; then
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 3. Deal Creation Integration Tests
if ! run_test_suite "Deal Creation Integration" "src/tests/contact-api-fix/DealCreationIntegration.test.tsx" "Tests end-to-end deal creation with contact integration"; then
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 4. API Error Handling Tests
if ! run_test_suite "API Error Handling" "src/tests/contact-api-fix/ApiErrorHandling.test.tsx" "Tests error handling for network failures and edge cases"; then
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 5. API Proxy Validation Tests
if [ "$INTEGRATION" = true ]; then
    if check_backend_server; then
        if ! run_test_suite "API Proxy Validation" "src/tests/contact-api-fix/ApiProxyValidation.test.tsx" "Tests proxy configuration and API endpoint routing"; then
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        print_warning "Skipping API Proxy Validation tests (backend server not running)"
        print_info "Start backend server with: npm run dev:api"
    fi
else
    if ! run_test_suite "API Proxy Validation" "src/tests/contact-api-fix/ApiProxyValidation.test.tsx" "Tests proxy configuration and API endpoint routing (mocked)"; then
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi

# Generate coverage report if requested
if [ "$COVERAGE" = true ]; then
    echo ""
    print_info "Generating coverage report..."
    if run_with_coverage "src/tests/contact-api-fix/"; then
        print_status "Coverage report generated in coverage/ directory"
        
        # Try to open coverage report
        if command -v open >/dev/null 2>&1; then
            print_info "Opening coverage report in browser..."
            open coverage/index.html
        elif command -v xdg-open >/dev/null 2>&1; then
            print_info "Opening coverage report in browser..."
            xdg-open coverage/index.html
        else
            print_info "Coverage report available at: coverage/index.html"
        fi
    fi
fi

# Summary
echo ""
echo "📊 Test Execution Summary"
echo "========================"

if [ $FAILED_TESTS -eq 0 ]; then
    print_status "All test suites passed! ✨"
    echo ""
    print_info "Contact API fix is working correctly"
    print_info "API proxy configuration is properly routing requests"
    print_info "Error handling is robust and user-friendly"
    
    # Additional recommendations
    echo ""
    print_info "💡 Recommendations:"
    echo "   • Run integration tests periodically: $0 --integration"
    echo "   • Generate coverage reports: $0 --coverage"
    echo "   • Monitor test performance in CI/CD"
    echo "   • Update tests when API changes are made"
    
else
    print_error "$FAILED_TESTS test suite(s) failed"
    echo ""
    print_info "🔍 Debugging steps:"
    echo "   1. Check if backend server is running (npm run dev:api)"
    echo "   2. Verify proxy configuration in vite.config.ts"
    echo "   3. Check network connectivity and firewall settings"
    echo "   4. Review test logs above for specific error details"
    echo "   5. Run individual test suites for more detailed output"
    
    echo ""
    print_info "📖 For more help, see:"
    echo "   • CONTACT_API_FIX_TESTING_GUIDE.md"
    echo "   • Individual test files in src/tests/contact-api-fix/"
    
    exit 1
fi

# Save test results
echo "$(date): Contact API Fix Tests - $FAILED_TESTS failures" >> test-results/contact-api-test-history.log

exit 0