# Performance Slowdown Analysis

## Suspected Root Cause: Duplicate RLS Policies

### The Problem

The `tasks` table has **21 RLS policies** (found when we ran `FINAL_RLS_FIX_V2.sql`):

```
Tasks table policies: 21 total
- 2 ALL policies (grants all permissions)
- 3 DELETE policies
- 3 INSERT policies
- 6 SELECT policies
- 3 UPDATE policies
```

### Why This Causes Slowness

**PostgreSQL RLS Policy Evaluation**:
1. For EVERY query, PostgreSQL must evaluate ALL applicable RLS policies
2. With 21 policies, it's checking many redundant conditions
3. Some policies conflict (e.g., multiple INSERT policies)
4. The database must OR all the policies together for each operation

**Performance Impact**:
- Simple query: Evaluates 6 SELECT policies
- Insert operation: Evaluates 3 INSERT policies
- Complex query with joins: Evaluates policies on EACH joined table
- The `useTasks` hook joins with 5 tables: tasks, profiles (2x), companies, contacts, meeting_action_items

### Calculation Example

When loading tasks page with `useTasks`:
```
Base query: tasks (6 SELECT policies to evaluate)
+ Join assignee profile (? policies)
+ Join creator profile (? policies)
+ Join company (? policies)
+ Join contact (? policies)
+ Join meeting_action_item (? policies)

= Potentially 30+ policy evaluations per row
× 50 tasks loaded
= 1500+ policy checks
```

## Immediate Fix

**Run the cleanup script**: `CLEANUP_TASKS_POLICIES.sql`

This will reduce from 21 policies → 4 essential policies:

```sql
1. "Allow all inserts" (INSERT)
2. "Users can view own tasks" (SELECT)
3. "Users can update own tasks" (UPDATE)
4. "Users can delete own tasks" (DELETE)
```

**Expected performance improvement**: 5-10x faster queries

## Other Potential Issues

### 1. Missing Indexes

Check if these indexes exist:
- `tasks(assigned_to)` - for user filtering
- `tasks(meeting_id)` - for meeting page
- `tasks(company_id)` - for company filtering
- `tasks(created_at)` - for sorting

### 2. Complex Joins in useTasks

The `useTasks` hook performs 5 joins on every query. Consider:
- Adding indexes on foreign keys
- Using `select` to limit returned columns
- Implementing pagination if loading many tasks

### 3. React Re-renders

Check if components are re-rendering unnecessarily:
- Use React DevTools Profiler
- Check for missing `useMemo`/`useCallback` dependencies
- Look for state updates in useEffect loops

## Testing Performance

### Before Cleanup
```bash
# Time a complex query
time curl "${SUPABASE_URL}/rest/v1/tasks?select=*,assignee:profiles!assigned_to(*)&limit=50"
```

### After Cleanup
```bash
# Run CLEANUP_TASKS_POLICIES.sql
# Then test again - should be noticeably faster
time curl "${SUPABASE_URL}/rest/v1/tasks?select=*,assignee:profiles!assigned_to(*)&limit=50"
```

## Quick Diagnosis Steps

1. **Check which page is slow**:
   - Tasks page? → RLS policies issue
   - Meetings page? → Check meeting queries
   - All pages? → Check browser console for errors

2. **Open browser DevTools**:
   - Network tab: Look for slow API calls (>500ms)
   - Console: Check for errors or warnings
   - Performance tab: Record and analyze

3. **Check Supabase Dashboard**:
   - Database → Query Performance
   - Look for slow queries (>100ms)

## Recommended Actions

### High Priority (Do Now)
1. ✅ Run `CLEANUP_TASKS_POLICIES.sql` to remove duplicate policies
2. Check browser console for JavaScript errors
3. Test specific pages to isolate the issue

### Medium Priority (If Still Slow)
1. Run `check-rls-performance.sql` to analyze indexes
2. Add missing indexes if found
3. Optimize heavy queries in components

### Low Priority (Future Optimization)
1. Implement query result caching
2. Add pagination to large lists
3. Use React Query's stale time settings
4. Consider database connection pooling

## Monitoring

After applying fixes, monitor:
- Page load times (should be <2s)
- API response times (should be <300ms)
- Browser memory usage
- Number of network requests

---

**Status**: Analysis complete
**Most Likely Cause**: 21 duplicate RLS policies on tasks table
**Quick Fix**: Run CLEANUP_TASKS_POLICIES.sql
**Expected Impact**: 5-10x performance improvement
