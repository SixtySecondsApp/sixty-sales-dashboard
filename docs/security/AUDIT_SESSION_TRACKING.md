# Audit Session Tracking Implementation

This document describes the session ID tracking implementation for the audit logs system, providing better security context and compliance.

## Overview

The audit session tracking system helps track user sessions across different actions and identify potential security issues by:

1. **Session ID Capture**: Automatically captures and stores session IDs in audit logs
2. **Session-based Filtering**: Allows filtering audit logs by session for better analysis
3. **Session Activity Summary**: Provides comprehensive session activity reports
4. **Cross-action Tracking**: Links related actions performed within the same session

## Database Changes

### Migration: `20250717162134_add_session_id_to_audit_logs.sql`

- **Added `session_id` column** to `audit_logs` table (TEXT type)
- **Added indexes** for efficient session-based queries:
  - `audit_logs_session_id_idx` on `session_id`
  - `audit_logs_user_session_idx` on `user_id, session_id`
- **Updated trigger function** to capture session information from multiple sources
- **Added new RPC functions**:
  - `get_audit_logs_by_session(session_id, limit)`
  - `get_session_activity_summary(session_id)`

### Session ID Capture Strategy

The audit trigger function tries to capture session IDs from multiple sources:

1. **App Setting**: `current_setting('app.session_id')` - set by client
2. **Auth JWT**: `auth.jwt() ->> 'session_id'` - from authentication token
3. **Auto-generated**: `auto_{user_id}_{timestamp}` - fallback for missing sessions

## Client-side Implementation

### Session Context Management

**Files**:
- `src/lib/utils/sessionContext.ts` - Core session management utilities
- `src/lib/hooks/useAuditSession.ts` - React hooks for session management
- `src/lib/utils/auditWrapper.ts` - Database operation wrappers

**Key Functions**:
- `initializeSession()` - Create new session on login
- `setSessionId(sessionId)` - Set session context for database operations
- `getSessionId()` - Retrieve current session ID
- `withAuditContext()` - Wrapper for database operations with session context

### React Integration

The session tracking is automatically initialized in the main App component:

```tsx
import { useInitializeAuditSession } from '@/lib/hooks/useAuditSession';

function App() {
  useInitializeAuditSession(); // Automatically manages session lifecycle
  // ... rest of component
}
```

## UI Enhancements

### AuditLogs Component Updates

**New Features**:
- **Session Filter**: Dropdown to filter logs by session ID
- **Session Tab**: Dedicated tab showing session summaries
- **Session Display**: Shows session ID in expanded log details
- **Session Actions**: Quick access to view all logs for a session

**Enhanced Interface**:
- Session information displayed in audit log metadata
- Session-based filtering in search functionality
- Session activity timeline and statistics

### Hook Updates

**`useAuditLogs` Enhanced Functions**:
- `getAuditLogsBySession(sessionId, limit)`
- `getSessionActivitySummary(sessionId)`
- `getSessionList(userId, limit)`
- Updated `searchAuditLogs` to include `sessionId` parameter

## Usage Examples

### Basic Session Tracking

```typescript
import { withAuditContext } from '@/lib/utils/auditWrapper';

// Automatically includes session context
const result = await withAuditContext(async () => {
  return await supabase.from('deals').insert(dealData);
});
```

### Session-based Queries

```typescript
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';

const { getAuditLogsBySession, getSessionActivitySummary } = useAuditLogs();

// Get all logs for a specific session
const sessionLogs = await getAuditLogsBySession('session_123', 100);

// Get session summary
const summary = await getSessionActivitySummary('session_123');
```

## Security Benefits

1. **Session Correlation**: Link related actions performed in the same session
2. **Anomaly Detection**: Identify unusual session patterns or concurrent sessions
3. **Compliance**: Enhanced audit trails for regulatory requirements
4. **Investigation**: Faster incident response with session-based filtering

## Performance Considerations

- **Indexed Queries**: Session-based queries use dedicated indexes
- **Lightweight Storage**: Session IDs are stored as TEXT (minimal overhead)
- **Efficient Filtering**: Session filters reduce data transfer and processing
- **Cached Sessions**: Session lists are cached client-side for performance

## Monitoring and Maintenance

### Session Cleanup

Sessions are automatically managed:
- **Storage**: Persisted in localStorage for user experience
- **Cleanup**: Cleared on logout or session expiration
- **Renewal**: New sessions created on login

### Database Monitoring

Monitor session-related metrics:
- Session duration and activity patterns
- User session overlap detection
- Session-based security alerts

## Future Enhancements

1. **Real-time Session Monitoring**: WebSocket-based session activity tracking
2. **Session Limits**: Enforce concurrent session limits per user
3. **Session Metrics**: Advanced analytics and reporting
4. **Integration**: Connect with external security monitoring systems

## Files Modified/Created

### Database
- `supabase/migrations/20250717162134_add_session_id_to_audit_logs.sql`

### Client Code
- `src/lib/utils/sessionContext.ts` (new)
- `src/lib/hooks/useAuditSession.ts` (new)
- `src/lib/utils/auditWrapper.ts` (new)
- `src/lib/hooks/useAuditLogs.ts` (modified)
- `src/pages/admin/AuditLogs.tsx` (modified)
- `src/App.tsx` (modified)

This implementation provides a comprehensive session tracking system that enhances the security and compliance capabilities of the audit logging system.