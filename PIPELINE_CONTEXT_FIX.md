# PipelineContext TypeError Fix

## Issue
The Pipeline page was crashing with the error:
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
at PipelineContext.tsx:354
```

## Root Cause
The `stage.name` property was being accessed without checking if it exists first. When a stage object didn't have a `name` property (undefined or null), calling `.toLowerCase()` on it caused the application to crash.

## Solution
Added null-safe optional chaining to check if the stage and its name property exist before calling `toLowerCase()`.

### Code Change in PipelineContext.tsx (line 353-356)

**Before:**
```typescript
const activeStages = stages.filter(stage => {
  const stageName = stage.name.toLowerCase();
  return activeStageNames.includes(stageName);
});
```

**After:**
```typescript
const activeStages = stages.filter(stage => {
  const stageName = stage?.name?.toLowerCase();
  return stageName && activeStageNames.includes(stageName);
});
```

## What This Fix Does
1. Uses optional chaining (`?.`) to safely access the `name` property
2. Only attempts to call `toLowerCase()` if both `stage` and `stage.name` exist
3. Adds an additional check to ensure `stageName` is truthy before including it in the filter

## Testing
1. Navigate to the Pipeline page
2. Verify the page loads without errors
3. Check that pipeline stages display correctly
4. Confirm that filtering and stage calculations work properly

## Prevention
When working with object properties that might be undefined:
- Always use optional chaining (`?.`) for nullable properties
- Check for existence before calling methods like `toLowerCase()`
- Consider providing default values where appropriate

## Related Fixes
This is similar to the fix we applied earlier in:
- DealWizard.tsx (stage name handling)
- useUser.ts (authentication data handling)

## Status
✅ Fixed and deployed to development server