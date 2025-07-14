# Setting Up Audit Logs

## Overview
We've created a comprehensive audit logging system to track all data changes and prevent future data loss issues like the meeting type changes.

## Features
- Tracks all INSERT, UPDATE, and DELETE operations
- Records before/after values for all changes
- Tracks which fields were changed
- Stores user information for each change
- Provides admin UI to view and search audit logs
- Functions to query specific field history

## Setup Instructions

### 1. Run the Database Migration
```bash
# Apply the audit log migration to your Supabase database
supabase db push
```

Or manually run the migration file:
```sql
-- Run the contents of: supabase/migrations/20250102_create_audit_logs.sql
```

### 2. Verify the Migration
The migration creates:
- `audit_logs` table to store all changes
- Audit triggers on: activities, deals, contacts, companies, tasks
- Helper functions: get_audit_history, get_field_history
- RLS policies (only admins can view audit logs)

### 3. Access Audit Logs
- Navigate to: Admin → Audit Logs in the application
- Only administrators can view audit logs
- You can filter by table, action type, and date range

## What Gets Tracked

### For Activities Table (including meeting types):
- All meeting type changes (details field)
- Status changes
- Client name changes
- Amount changes
- Any other field modifications

### For Other Tables:
- All field changes in deals, contacts, companies, and tasks

## Using the Audit Log Data

### Example: Finding Original Meeting Types
```sql
-- Find all meeting type changes
SELECT 
    changed_at,
    old_data->>'details' as original_type,
    new_data->>'details' as changed_to,
    record_id as activity_id
FROM audit_logs
WHERE table_name = 'activities'
    AND 'details' = ANY(changed_fields)
ORDER BY changed_at DESC;
```

### Example: Restoring Specific Values
```sql
-- If you identify patterns, you can restore values
UPDATE activities
SET details = 'Discovery'  -- original value from audit log
WHERE id = 'specific-activity-id'
    AND details = 'Discovery Call';
```

## Preventing Future Issues

Now that audit logging is in place:
1. All data changes are tracked automatically
2. You can always see what was changed, when, and by whom
3. Original values are preserved in the audit log
4. Easy restoration if mistakes happen

## Admin Features

### Audit Log Viewer Component
Use the `AuditLogViewer` component to show change history in any admin view:

```tsx
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

// Show history for a specific field
<AuditLogViewer
  tableName="activities"
  recordId={activityId}
  fieldName="details"
  title="Meeting Type History"
/>
```

### Audit Logs Page
- Full searchable audit trail
- Filter by table, action, date range
- Expandable view to see exact changes
- Shows old vs new values for each field

## Notes
- Audit logs are immutable (cannot be edited or deleted)
- Only administrators can view audit logs
- Storage considerations: audit logs will grow over time
- Consider archiving old audit logs periodically