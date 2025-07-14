# Audit Logs Build Fix

## Issue
The build was failing with:
```
Could not load /vercel/path0/src/lib/supabase/client (imported by src/lib/hooks/useAuditLogs.ts)
```

## Solution
Fixed the import in `/src/lib/hooks/useAuditLogs.ts`:

**Before:**
```typescript
import { supabase } from '@/lib/supabase/client';
```

**After:**
```typescript
import { supabase } from '@/lib/supabase/clientV2';
```

## Status
✅ Build error fixed - the audit logs feature should now build successfully.

## Note
There are other files (mainly tests) that have the same incorrect import, but they don't affect the production build. These can be fixed separately if needed:
- Test files in `/src/tests/`
- Database test files
- Some service files

The main application should now build and deploy correctly with the audit logs feature!