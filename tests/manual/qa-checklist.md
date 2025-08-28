# Manual Testing Checklist - Sixty Sales Dashboard

## Pre-Testing Setup
- [ ] Verify test environment is running (development server on http://127.0.0.1:5173)
- [ ] Confirm test user credentials are available
- [ ] Clear browser cache and cookies
- [ ] Open browser developer tools and monitor Console/Network tabs

## 1. Critical Issues Verification (High Priority)

### 1.1 Static Resource Loading
**Issue**: Verify no 404 errors for static resources
- [ ] Navigate to the homepage
- [ ] Check Network tab for any 404 errors on .css, .js, .svg, .png, .ico files
- [ ] ✅ **Expected**: All static resources load successfully (200 status)
- [ ] ❌ **Bug if**: Any static resources return 404 errors

### 1.2 Console Errors
**Issue**: Verify no JavaScript errors on page load
- [ ] Navigate to different pages (Dashboard, Contacts, Deals, etc.)
- [ ] Monitor Console tab for errors (ignore warnings and info)
- [ ] ✅ **Expected**: No critical JavaScript errors
- [ ] ❌ **Bug if**: Console shows JavaScript errors (not including favicon.ico or ResizeObserver warnings)

### 1.3 Authentication Flow
**Issue**: Verify authentication works correctly
- [ ] Navigate to `/auth`
- [ ] Try invalid credentials: `invalid@example.com` / `wrongpassword`
- [ ] ✅ **Expected**: Error message displayed clearly
- [ ] Try valid test credentials (if available)
- [ ] ✅ **Expected**: Successful login redirects to dashboard
- [ ] Test logout functionality
- [ ] ✅ **Expected**: Successful logout redirects to auth page

### 1.4 403 Forbidden Errors for Contacts
**Issue**: Verify contact creation doesn't return 403 Forbidden errors
- [ ] Open Network tab in DevTools
- [ ] Navigate to contacts section
- [ ] Try to create a new contact (use form or QuickAdd)
- [ ] Fill in: First Name: "Test", Last Name: "User", Email: "test@example.com"
- [ ] Submit form
- [ ] Check Network tab for any 403 responses
- [ ] ✅ **Expected**: No 403 Forbidden errors on contact-related requests
- [ ] ❌ **Bug if**: 403 errors appear when creating or accessing contacts

## 2. QuickAdd Functionality Testing

### 2.1 Modal Operations
- [ ] Open QuickAdd modal (look for button with "Quick Add" or "+" icon)
- [ ] ✅ **Expected**: Modal opens with all action options visible
- [ ] Verify all actions present: Task, Deal, Sale, Outbound, Meeting, Proposal
- [ ] Close modal with X button
- [ ] ✅ **Expected**: Modal closes completely
- [ ] Reopen modal
- [ ] ✅ **Expected**: Modal shows action selection again

### 2.2 Task Creation
- [ ] Open QuickAdd → Select "Add Task"
- [ ] Try submitting empty form
- [ ] ✅ **Expected**: Validation error for required title field
- [ ] Fill in task title: "Test Task from QA"
- [ ] Select task type (if available)
- [ ] Set priority (if available)
- [ ] Set due date (try quick date options)
- [ ] Submit form
- [ ] ✅ **Expected**: Success message or modal closes with confirmation
- [ ] ❌ **Bug if**: Form submission fails with error or hangs

### 2.3 Contact-Required Actions (Meeting, Proposal, Sale)
- [ ] Open QuickAdd → Select "Add Meeting"
- [ ] ✅ **Expected**: Contact search/selection interface appears
- [ ] Try submitting without selecting contact
- [ ] ✅ **Expected**: Validation error about missing contact
- [ ] Try searching for contacts (if search available)
- [ ] Select or enter contact information
- [ ] Fill required fields (company name, etc.)
- [ ] Submit form
- [ ] Monitor Network tab for 403 errors
- [ ] ✅ **Expected**: No 403 errors during submission

### 2.4 Form Validation
- [ ] Test each QuickAdd action with missing required fields
- [ ] ✅ **Expected**: Clear validation messages for each missing field
- [ ] Test with invalid data (invalid email formats, etc.)
- [ ] ✅ **Expected**: Appropriate validation messages
- [ ] Test with valid data
- [ ] ✅ **Expected**: Successful submission

### 2.5 Loading States
- [ ] Submit any QuickAdd form and watch submit button
- [ ] ✅ **Expected**: Loading indicator appears during submission
- [ ] ✅ **Expected**: Button is disabled during submission
- [ ] Wait for completion
- [ ] ✅ **Expected**: Loading state clears and shows success/error state

## 3. Web Vitals and Performance

### 3.1 Page Load Performance
- [ ] Navigate to different pages and monitor load times
- [ ] ✅ **Expected**: Pages load within 3 seconds on good connection
- [ ] Check for performance metrics in DevTools
- [ ] ✅ **Expected**: No critical performance warnings

### 3.2 Web Vitals Integration
- [ ] Check Console for any web vitals related errors
- [ ] ✅ **Expected**: No errors mentioning "vitals", "CLS", "FID", or "LCP"
- [ ] ❌ **Bug if**: Web vitals integration causes JavaScript errors

## 4. Form Error Handling

### 4.1 User-Friendly Error Messages
- [ ] Simulate network issues (disconnect internet briefly)
- [ ] Try submitting forms during network issues
- [ ] ✅ **Expected**: Clear, user-friendly error messages
- [ ] ❌ **Bug if**: Technical error messages shown to users
- [ ] ❌ **Bug if**: Forms hang without feedback

### 4.2 Authentication Error Handling
- [ ] Try accessing protected resources after token expires
- [ ] ✅ **Expected**: Clear authentication error messages
- [ ] ✅ **Expected**: Guidance on how to resolve (sign in again, etc.)

## 5. Navigation and UI Consistency

### 5.1 Navigation Between Sections
- [ ] Navigate to: Dashboard, Contacts, Deals, Activities, Tasks
- [ ] ✅ **Expected**: Each section loads without errors
- [ ] ✅ **Expected**: Navigation remains consistent
- [ ] Check for broken links or 404 pages
- [ ] ❌ **Bug if**: Any navigation results in errors or broken pages

### 5.2 Responsive Design
- [ ] Test on different screen sizes (desktop, tablet, mobile)
- [ ] ✅ **Expected**: Layout adapts properly to screen size
- [ ] ✅ **Expected**: All functionality accessible on mobile
- [ ] Test QuickAdd modal on mobile
- [ ] ✅ **Expected**: Modal is usable on small screens

## 6. Data Persistence and Consistency

### 6.1 Data Creation Verification
- [ ] Create test data through various forms
- [ ] Navigate away and return
- [ ] ✅ **Expected**: Created data appears in lists
- [ ] ✅ **Expected**: Data is properly formatted and complete

### 6.2 Real-time Updates
- [ ] Create items and check if lists update automatically
- [ ] ✅ **Expected**: New items appear without page refresh (if real-time enabled)
- [ ] If not real-time, refresh page manually
- [ ] ✅ **Expected**: New items appear after refresh

## 7. Admin Functionality (If Admin User Available)

### 7.1 Revenue Split Features
- [ ] Login as admin user
- [ ] Open QuickAdd → Select "Add Sale"
- [ ] ✅ **Expected**: Revenue split fields visible (Monthly MRR, One-off Revenue)
- [ ] Fill in both MRR and One-off amounts
- [ ] ✅ **Expected**: LTV calculation shown
- [ ] Submit form
- [ ] ✅ **Expected**: Sale created with proper deal value calculation

### 7.2 Admin Controls
- [ ] Verify admin-only features are available
- [ ] ✅ **Expected**: Admin users can access revenue splitting
- [ ] Test with non-admin user (if available)
- [ ] ✅ **Expected**: Non-admin users don't see admin-only features

## 8. Edge Cases and Stress Testing

### 8.1 Large Data Sets
- [ ] Test with lists containing many items
- [ ] ✅ **Expected**: Performance remains acceptable
- [ ] ✅ **Expected**: Pagination or virtual scrolling works (if implemented)

### 8.2 Special Characters and Inputs
- [ ] Test with special characters in names: "O'Connor", "Smith-Jones", "François"
- [ ] Test with long inputs (very long company names, descriptions)
- [ ] Test with international characters and emojis
- [ ] ✅ **Expected**: System handles all inputs gracefully

### 8.3 Browser Compatibility
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] ✅ **Expected**: Core functionality works in all browsers
- [ ] Note any browser-specific issues

## 9. Accessibility Testing

### 9.1 Keyboard Navigation
- [ ] Navigate entire application using only keyboard (Tab, Enter, arrows)
- [ ] ✅ **Expected**: All interactive elements are accessible
- [ ] ✅ **Expected**: Focus indicators are visible

### 9.2 Screen Reader Compatibility
- [ ] Test with screen reader (if available)
- [ ] ✅ **Expected**: Content is properly announced
- [ ] ✅ **Expected**: Form labels are associated correctly

## 10. Security Testing

### 10.1 Data Validation
- [ ] Try submitting forms with malicious inputs (script tags, SQL injection attempts)
- [ ] ✅ **Expected**: Inputs are properly sanitized
- [ ] ✅ **Expected**: No XSS vulnerabilities

### 10.2 Authentication Security
- [ ] Test session timeout behavior
- [ ] Test with expired tokens
- [ ] ✅ **Expected**: Proper security handling without exposing sensitive information

## Testing Results Template

### Test Session Information
- **Date**: ___________
- **Tester**: ___________
- **Browser**: ___________
- **Test Environment**: ___________

### Critical Issues Found
| Issue | Severity | Status | Description |
|-------|----------|--------|-------------|
|       |          |        |             |

### Summary
- **Total Tests**: ___ / ___
- **Passed**: ___
- **Failed**: ___
- **Blocked**: ___

### Recommendations
- [ ] Ready for production
- [ ] Needs fixes before release
- [ ] Requires additional testing

### Notes
_Additional observations, suggestions, or comments_

## Severity Levels
- **Critical**: Prevents core functionality, security issues, data loss
- **High**: Major functionality affected, poor user experience
- **Medium**: Minor functionality issues, cosmetic problems
- **Low**: Enhancement requests, nice-to-have improvements

## Test Data Cleanup
After testing, remember to:
- [ ] Delete test contacts created during testing
- [ ] Remove test tasks, deals, and activities
- [ ] Clear test data to avoid cluttering the system