# Proposal Creation Fix

## Issue
When adding a proposal through Quick Add:
1. Multiple success toasts were shown
2. The proposal activity was not being created
3. Only a deal was being created, not the associated proposal activity

## Root Cause
The DealWizard component was:
1. Always creating a proposal activity regardless of the action type (deal vs proposal)
2. Not receiving information about what action triggered it
3. Showing duplicate success toasts (one from DealWizard, one from QuickAdd)

## Solution Implemented

### 1. Pass Action Type to DealWizard
Added `actionType` prop to DealWizard to distinguish between:
- Creating a deal only
- Creating a deal with a proposal activity
- Creating a deal for a sale

### 2. Conditional Activity Creation
The DealWizard now only creates a proposal activity when `actionType === 'proposal'`

### 3. Fixed Duplicate Toasts
- Removed duplicate success toast from QuickAdd
- DealWizard now shows appropriate message based on action type

### 4. Updated UI Labels
The DealWizard UI now shows:
- "Create Deal & Proposal" when opened from "Add Proposal"
- "Create New Deal" when opened from "Create Deal"

## Code Changes

### QuickAdd.tsx
```typescript
// Added actionType prop to DealWizard
<DealWizard
  isOpen={showDealWizard}
  actionType={selectedAction as 'deal' | 'proposal' | 'sale'}
  onClose={() => {...}}
  onDealCreated={(deal) => {
    // Removed duplicate toast.success()
  }}
/>
```

### DealWizard.tsx
```typescript
// Added actionType to props
interface DealWizardProps {
  ...
  actionType?: 'deal' | 'proposal' | 'sale';
}

// Only create proposal activity when needed
if (actionType === 'proposal') {
  await addActivityAsync({
    type: 'proposal',
    ...
  });
}

// Show appropriate success message
if (actionType === 'proposal') {
  toast.success('Deal and proposal created successfully!');
} else {
  toast.success('Deal created successfully!');
}
```

## Expected Behavior

### When "Create Deal" is clicked:
1. Opens DealWizard
2. Creates only a deal
3. Shows "Deal created successfully!"
4. Deal appears in pipeline

### When "Add Proposal" is clicked:
1. Opens DealWizard
2. Creates a deal AND a proposal activity
3. Shows "Deal and proposal created successfully!"
4. Deal appears in pipeline
5. Proposal activity appears in activities table

## Testing Instructions
1. Click Quick Add (green + button)
2. Click "Add Proposal"
3. Select/create a contact
4. Fill in deal details
5. Click "Create Deal & Proposal"
6. Verify:
   - Only ONE success toast appears
   - Deal appears in pipeline
   - Proposal activity appears in activities table
   - Console shows both deal and proposal creation logs

## Status
✅ Fixed and ready for testing