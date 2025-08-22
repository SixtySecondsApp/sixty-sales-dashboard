# Quick Add Modal - Manual Testing Guide

## Test Setup
1. Ensure the app is running at http://localhost:5173
2. Login with valid credentials
3. Navigate to the dashboard

## Test Cases

### ✅ 1. Deal Creation via Quick Add
**Steps:**
1. Click the Quick Add button (+ icon)
2. Select "Create Deal"
3. Verify the DealWizard opens
4. Verify the contact search modal opens automatically
5. Search for or create a new contact
6. Fill in deal details (name, company, value)
7. Submit the deal

**Expected Results:**
- Deal is created successfully
- Deal appears in the pipeline
- Success toast notification appears

### ✅ 2. Task Creation
**Steps:**
1. Open Quick Add modal
2. Select "Add Task"
3. Enter task title: "Follow up with client"
4. Select task type: "Follow Up"
5. Select priority: "High"
6. Choose due date: "Tomorrow 9AM"
7. Submit

**Expected Results:**
- Task is created successfully
- Task appears in task list
- Success notification

### ✅ 3. Meeting Creation (SQL Meeting)
**Steps:**
1. Open Quick Add modal
2. Select "Add Meeting"
3. Enter client name: "Test Company"
4. Select meeting type: "Discovery"
5. Enter contact identifier (email/phone)
6. Select date: Today
7. Submit

**Expected Results:**
- Meeting activity is created
- Activity appears on dashboard
- Success notification

### ✅ 4. Proposal Creation (Verbal Commitment)
**Steps:**
1. Open Quick Add modal
2. Select "Add Proposal"
3. Enter client name
4. Enter One-off Revenue: £5000
5. Enter Monthly MRR: £1000
6. Select or create a deal (REQUIRED)
7. Enter contact identifier
8. Submit

**Expected Results:**
- Proposal activity is created
- LTV calculated as: (£1000 × 3) + £5000 = £8000
- Activity linked to selected deal
- Appears on dashboard

### ✅ 5. Sales Creation
**Steps:**
1. Open Quick Add modal
2. Select "Add Sale"
3. Enter client name
4. Select sale type: "subscription"
5. Enter Monthly MRR: £2000
6. Enter contact identifier
7. Submit

**Expected Results:**
- Sale activity is created
- Deal is auto-created if not selected
- LTV calculated correctly: £2000 × 3 = £6000
- Appears on dashboard with confetti

### ✅ 6. Outbound Activity
**Steps:**
1. Open Quick Add modal
2. Select "Add Outbound"
3. Enter client name
4. Select type: "LinkedIn"
5. Enter quantity: 5
6. Contact identifier is optional
7. Submit

**Expected Results:**
- Outbound activity is created
- Activity appears on dashboard
- If identifier provided, triggers contact processing

## Validation Tests

### ❌ 1. Required Fields
- Task without title should show error
- Meeting without type should show error
- Proposal without deal should show error
- Non-outbound activities without identifier should show error

### ❌ 2. LTV Calculations
- One-off sale: Amount = entered value
- Subscription: LTV = Monthly × 3
- Lifetime deal: LTV = entered value (not doubled)
- Mixed: LTV = (Monthly × 3) + One-off

## Dashboard Verification

After creating each item, verify:
1. Activities appear in activity feed
2. Deals appear in pipeline
3. Tasks appear in task list
4. Metrics update correctly
5. No console errors

## Known Issues to Test
- [x] DealWizard now skips first screen
- [x] Contact search opens automatically
- [x] LTV calculation for lifetime deals (should not double)
- [ ] Contact processing for activities with identifiers

## Test Results Summary
- [ ] All deal creations work
- [ ] All activity types create successfully
- [ ] Dashboard displays all items correctly
- [ ] Validation errors show appropriately
- [ ] LTV calculations are accurate