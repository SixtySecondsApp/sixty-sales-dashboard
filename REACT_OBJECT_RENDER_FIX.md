# React Object Rendering Fix

## Issue
```
Error: Objects are not valid as a React child
(found: object with keys {id, name, domain})
```

## Root Cause

When we fixed the `useTasks` hook by removing the broken `suggestion` join, we kept the other joins including `company:companies(id, name, domain)`.

This changed `task.company` from a **string** to an **object**:

```typescript
// Old schema (string):
task.company = "Acme Corp"

// New schema (object from join):
task.company = {
  id: "uuid",
  name: "Acme Corp",
  domain: "acme.com"
}
```

## Files Fixed

### 1. TaskKanban.tsx
**Lines Fixed**: 859, 863

**Changes**:
```typescript
// Before (renders object - ERROR):
{task.company}

// After (renders name property):
{typeof task.company === 'object' ? task.company?.name : task.company}
```

### 2. TaskDetailModal.tsx
**Lines Fixed**: 340, 348, 366

**Changes**:
```typescript
// Render in DOM:
{typeof task.company === 'object' ? task.company?.name : task.company}

// Aria label:
aria-label={`Navigate to company ${typeof task.company === 'object' ? task.company?.name : task.company}`}
```

## Pattern Used

**Safe Rendering Pattern**:
```typescript
{typeof task.company === 'object' ? task.company?.name : task.company}
```

This handles:
- ✅ **Object format** (from useTasks join): Extract `.name` property
- ✅ **String format** (legacy/fallback): Use string directly
- ✅ **Null/undefined**: Optional chaining prevents errors

## Why This Happened

1. `useTasks.ts` includes join: `company:companies(id, name, domain)`
2. This populates `task.company` with full object
3. React cannot render objects directly (only primitives)
4. Components tried to render `{task.company}` → ERROR

## Alternative Solutions Considered

### Option 1: Remove company join (rejected)
```typescript
// Would fix error but lose company data
.select('*, assignee:profiles!assigned_to(...)')
// No company join
```
**Why rejected**: We need company data for navigation and display

### Option 2: Add company_name column (rejected)
```sql
ALTER TABLE tasks ADD COLUMN company_name TEXT;
```
**Why rejected**: Redundant data, requires migration

### Option 3: Transform in hook (rejected)
```typescript
// In useTasks.ts:
tasks.map(task => ({
  ...task,
  company: task.company?.name || task.company
}))
```
**Why rejected**: Loses company.id and company.domain data

### Option 4: Component-level handling (CHOSEN) ✅
```typescript
// In components:
{typeof task.company === 'object' ? task.company?.name : task.company}
```
**Why chosen**:
- Preserves all data
- Backward compatible
- Component has full control
- Can access company.id, company.domain when needed

## Testing

### Verify Fix
1. Navigate to `/tasks`
2. View tasks with company associations
3. Should display company names without errors
4. Click task to open TaskDetailModal
5. Company should display correctly
6. No React errors in console

### Verification Commands
```bash
# Check for any remaining object renders
grep -rn "{\\s*task\\.company\\s*}" src/components --include="*.tsx"

# Should return only aria-labels with our safe pattern
```

## Future Considerations

### If More Fields Need Similar Fix

Check these task fields that might be objects from joins:
- `task.contact` → `{id, full_name, first_name, last_name, email}`
- `task.assignee` → `{id, first_name, last_name, email, avatar_url}`
- `task.creator` → `{id, first_name, last_name, email, avatar_url}`

Use the same pattern:
```typescript
{typeof task.field === 'object' ? task.field?.display_property : task.field}
```

### Type Safety Improvement

Consider adding TypeScript type for task.company:
```typescript
interface Task {
  // ... other fields
  company?: string | { id: string; name: string; domain: string };
  // This documents the dual format
}
```

## Related Issues

- Issue #32: Tasks not showing in meeting view (fixed in useTasks.ts)
- This fix: React object rendering errors (fixed in components)

Both caused by schema changes when moving `suggestion_id` to metadata.

---

**Status**: ✅ FIXED
**Files Modified**: 2 (TaskKanban.tsx, TaskDetailModal.tsx)
**Lines Changed**: 5 total
**Date**: 2025-11-01
