# DealWizard - Manual Testing Guide

## Test Scenarios

### ✅ 1. Initial Opening Behavior
**Steps:**
1. Open Quick Add modal
2. Click "Create Deal"
3. **Expected:** DealWizard opens AND contact search modal opens automatically
4. **Expected:** No errors in console

### ✅ 2. Contact Selection Flow
**Steps:**
1. Open DealWizard (contact search should auto-open)
2. Search for a contact or create new one
3. Select the contact
4. **Expected:** Contact search closes, selected contact is shown
5. **Expected:** Deal form fields are visible

### ✅ 3. Closing and Reopening
**Steps:**
1. Open DealWizard
2. Select a contact
3. Close the wizard (X button)
4. Open DealWizard again
5. **Expected:** Contact search opens automatically again
6. **Expected:** Previous contact selection is cleared

### ✅ 4. Back Button Behavior
**Steps:**
1. Open DealWizard
2. Select a contact
3. Try to go back or change contact
4. **Expected:** Can change contact without issues
5. **Expected:** No screen showing "type name and email"

### ✅ 5. Error Prevention
**Verify no errors for:**
- Opening wizard when no stages exist
- Opening wizard multiple times rapidly
- Closing wizard while contact search is open
- Closing contact search without selecting

## Fixed Issues
- ✅ `toLowerCase()` error on undefined stage names
- ✅ Contact search not opening on subsequent opens
- ✅ Wrong screen showing when going back
- ✅ State not resetting properly on close

## Console Checks
- No "Cannot read properties of undefined" errors
- No React key warnings
- No infinite loop warnings