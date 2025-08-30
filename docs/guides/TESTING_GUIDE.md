# Comprehensive Testing Guide - Sixty Sales Dashboard

## Overview

This guide covers the complete testing setup and execution for the Sixty Sales Dashboard, including all implemented fixes for:
- 403 Forbidden errors for Supabase contacts
- Static resource loading (404 errors)
- QuickAdd form functionality with proper error handling
- Web vitals integration
- Authentication flow improvements
- RLS policies validation

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:regression  # Regression tests
```

## 📁 Test Structure

```
tests/
├── e2e/                           # End-to-end tests (Playwright)
│   ├── 01-critical-flows.spec.ts  # Core functionality tests
│   ├── 02-quickadd-functionality.spec.ts
│   └── 03-contact-management.spec.ts
├── unit/                          # Unit tests (Vitest)
│   ├── authUtils.test.ts
│   ├── adminUtils.test.ts
│   └── QuickAdd.test.tsx
├── integration/                   # Integration tests
│   ├── supabase-auth.test.ts
│   └── api-endpoints.test.ts
├── regression/                    # Regression tests
│   └── regression-tests.spec.ts
├── manual/                        # Manual testing resources
│   └── qa-checklist.md
└── fixtures/                      # Test data and utilities
    ├── auth.setup.ts
    └── test-data.ts
```

## 🔧 Setup Instructions

### 1. Environment Setup

Create a `.env.test` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Test User Credentials (Optional - for authenticated tests)
TEST_USER_EMAIL=test.user@example.com
TEST_USER_PASSWORD=TestPassword123!

# Admin User Credentials (Optional - for admin tests)
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=AdminPassword123!
```

### 2. Install Dependencies

```bash
# Install project dependencies
npm install

# Install Playwright browsers
npx playwright install

# Install additional browser dependencies (if needed)
npx playwright install-deps
```

### 3. Development Server

Tests require the development server to be running:

```bash
# Start development server
npm run dev

# Server should be available at http://127.0.0.1:5173
```

## 🧪 Test Execution

### Unit Tests

```bash
# Run unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with coverage
npm run test:unit:coverage
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run specific integration test
npx vitest tests/integration/supabase-auth.test.ts
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (visible browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/01-critical-flows.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Regression Tests

```bash
# Run regression test suite
npm run test:regression

# Run regression tests with trace
npx playwright test tests/regression/regression-tests.spec.ts --trace on
```

### All Tests

```bash
# Run complete test suite
npm run test:all

# Run tests in CI mode
npm run test:ci
```

## 📋 Test Categories

### 1. Critical Flow Tests

**Purpose**: Verify core functionality works correctly

**Covers**:
- Page loads without 404 errors
- No console errors on load
- Authentication flow
- QuickAdd modal operations
- Contact creation (no 403 errors)
- Form validation
- Navigation between sections

### 2. QuickAdd Functionality Tests

**Purpose**: Comprehensive testing of QuickAdd component

**Covers**:
- Modal display and interaction
- Task creation with validation
- Contact-dependent actions (meeting, proposal, sale)
- Form reset between actions
- Loading states
- Error handling

### 3. Contact Management Tests

**Purpose**: Verify contact operations work without permission errors

**Covers**:
- Contact creation without 403 errors
- Contact search and selection
- Contact validation
- Contact linking in activities
- Modal interactions

### 4. Authentication & Authorization Tests

**Purpose**: Verify auth improvements and RLS policies

**Covers**:
- Session management
- Token refresh
- Permission validation
- Error handling
- User-friendly error messages

### 5. Regression Tests

**Purpose**: Prevent previously fixed issues from reoccurring

**Covers**:
- Static resource loading fixes
- Console error fixes
- 403 error fixes
- Performance improvements
- Cross-browser compatibility

## 🎯 Test Scenarios by Fixed Issue

### 403 Forbidden Error Fixes

**Tests Location**: 
- `tests/e2e/03-contact-management.spec.ts`
- `tests/integration/supabase-auth.test.ts`
- `tests/regression/regression-tests.spec.ts`

**What's Tested**:
```bash
# Monitor network requests during contact operations
npm run test:e2e -- --grep "403"

# Specific test
npx playwright test -g "403 Forbidden errors do not occur"
```

### Static Resource Loading Fixes

**Tests Location**: 
- `tests/e2e/01-critical-flows.spec.ts`
- `tests/regression/regression-tests.spec.ts`

**What's Tested**:
```bash
# Test static resource loading
npx playwright test -g "static resources"

# Full regression test
npm run test:regression
```

### QuickAdd Form Improvements

**Tests Location**: 
- `tests/e2e/02-quickadd-functionality.spec.ts`
- `tests/unit/QuickAdd.test.tsx`

**What's Tested**:
```bash
# QuickAdd functionality
npx playwright test tests/e2e/02-quickadd-functionality.spec.ts

# QuickAdd unit tests
npx vitest tests/unit/QuickAdd.test.tsx
```

### Authentication Improvements

**Tests Location**: 
- `tests/unit/authUtils.test.ts`
- `tests/integration/supabase-auth.test.ts`

**What's Tested**:
```bash
# Auth utility functions
npx vitest tests/unit/authUtils.test.ts

# Full auth integration
npx vitest tests/integration/supabase-auth.test.ts
```

## 🔍 Test Debugging

### Playwright Debug Mode

```bash
# Run tests in debug mode
npx playwright test --debug

# Run specific test in debug mode
npx playwright test tests/e2e/01-critical-flows.spec.ts --debug

# Run with trace viewer
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### View Test Reports

```bash
# Open Playwright HTML report
npx playwright show-report

# Open Vitest UI
npx vitest --ui
```

### Screenshots and Videos

Playwright automatically captures:
- Screenshots on failure
- Videos for failed tests
- Traces for debugging

Located in: `test-results/`

## 📊 Continuous Integration

### GitHub Actions Configuration

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

## 📝 Manual Testing

### QA Checklist

Use the comprehensive manual testing checklist:

```bash
# Open QA checklist
open tests/manual/qa-checklist.md
```

**Key Manual Test Areas**:
1. Cross-browser compatibility
2. Accessibility testing
3. Mobile responsiveness
4. Edge cases and error scenarios
5. Performance validation
6. Security testing

### Manual Test Execution

1. **Pre-testing Setup**
   - Clear browser cache
   - Open DevTools (Console + Network tabs)
   - Prepare test data

2. **Critical Path Testing**
   - Authentication flow
   - QuickAdd operations
   - Contact management
   - Form submissions

3. **Error Scenario Testing**
   - Network failures
   - Invalid inputs
   - Permission errors
   - Session expiration

## 🚨 Troubleshooting

### Common Issues

#### Test Failures

```bash
# Clear Playwright cache
npx playwright install --force

# Clear node modules
rm -rf node_modules package-lock.json
npm install
```

#### Environment Issues

```bash
# Check environment variables
echo $VITE_SUPABASE_URL
echo $TEST_USER_EMAIL

# Verify development server
curl http://127.0.0.1:5173
```

#### Database Connection Issues

```bash
# Test Supabase connection
npx vitest tests/integration/supabase-auth.test.ts --reporter=verbose
```

### Test Data Cleanup

```bash
# Run cleanup script (if available)
npm run test:cleanup

# Manual cleanup in Supabase dashboard
# Delete test contacts, activities, deals, tasks
```

## 📈 Performance Testing

### Lighthouse Integration

```bash
# Install lighthouse
npm install -g lighthouse

# Run lighthouse on development server
lighthouse http://127.0.0.1:5173 --output json --output html
```

### Performance Monitoring

```bash
# Run performance-focused tests
npx playwright test -g "performance"

# Monitor memory usage
npx playwright test --trace on -g "memory"
```

## 🔒 Security Testing

### Basic Security Tests

```bash
# Run security-focused tests
npx playwright test -g "security"

# Test authentication scenarios
npx vitest tests/integration/supabase-auth.test.ts -t "security"
```

### Manual Security Testing

1. **Input Validation**
   - Test XSS prevention
   - Test SQL injection prevention
   - Test input sanitization

2. **Authentication Security**
   - Test session management
   - Test token expiration
   - Test permission enforcement

## 📋 Test Coverage Reports

### Unit Test Coverage

```bash
# Generate coverage report
npm run test:unit:coverage

# Open coverage report
open coverage/index.html
```

### E2E Test Coverage

```bash
# Run E2E tests with coverage
npx playwright test --reporter=html

# View detailed report
npx playwright show-report
```

## 🎯 Success Criteria

### All Tests Must Pass

- ✅ Unit tests: 100% pass rate
- ✅ Integration tests: 100% pass rate  
- ✅ E2E tests: 100% pass rate
- ✅ Regression tests: 100% pass rate

### Performance Benchmarks

- ✅ Page load times: < 3 seconds
- ✅ Form submissions: < 2 seconds
- ✅ No memory leaks detected
- ✅ No console errors

### Security Requirements

- ✅ No 403 Forbidden errors
- ✅ Proper authentication handling
- ✅ Input validation working
- ✅ RLS policies enforced

### User Experience

- ✅ Forms show clear validation messages
- ✅ Error handling is user-friendly
- ✅ Loading states are visible
- ✅ Cross-browser compatibility

## 📞 Support

For testing questions or issues:

1. Check this testing guide
2. Review test error messages and logs
3. Check the manual QA checklist
4. Review individual test files for context
5. Contact the development team with specific error details

## 🔄 Test Maintenance

### Regular Tasks

- Update test data fixtures when schema changes
- Add regression tests for new bug fixes
- Update manual checklist for new features
- Review and update test environment setup

### Adding New Tests

1. **For new features**: Add unit tests first, then E2E tests
2. **For bug fixes**: Add regression tests to prevent recurrence
3. **For API changes**: Update integration tests
4. **For UI changes**: Update E2E and accessibility tests

---

**Note**: This testing guide covers all fixes implemented for the Sixty Sales Dashboard. Run the complete test suite before any deployment to ensure all fixes remain functional and no regressions are introduced.