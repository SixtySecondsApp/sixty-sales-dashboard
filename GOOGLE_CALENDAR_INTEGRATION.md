# Google Calendar Integration Documentation

## Overview
The Sixty Sales Dashboard includes a comprehensive Google Calendar integration that allows users to sync their calendar events with the CRM system. The integration is designed with a **manual-first approach**, giving users complete control over when and what data is synchronized.

## Key Features

### Manual Sync Control
- **No Automatic Syncing**: The system never automatically syncs calendar data
- **User-Initiated Operations**: All sync operations require explicit user action
- **Progressive Sync Options**: Start with test sync, then expand as needed

### Sync Operations

#### 1. Test Sync (Last 7 Days)
- Syncs the last 7 days of calendar events
- Limited to 50 events maximum
- Perfect for testing the integration
- Endpoint: `sync-single` action

#### 2. Incremental Sync
- Syncs changes since last sync operation
- Uses Google Calendar sync tokens for efficiency
- Minimal API calls and data transfer
- Endpoint: `sync-incremental` action

#### 3. Historical Sync
- Syncs all events from a specified date range
- Useful for initial data import
- Can handle large volumes of events
- Endpoint: `sync-historical` action

## Technical Architecture

### Database Schema

#### calendar_events Table
```sql
- id: UUID (Primary Key)
- external_id: TEXT (Google Calendar Event ID)
- user_id: UUID (References auth.users)
- calendar_id: UUID (References calendar_calendars)
- title: TEXT
- description: TEXT
- location: TEXT
- start_time: TIMESTAMPTZ
- end_time: TIMESTAMPTZ
- all_day: BOOLEAN
- status: TEXT
- meeting_url: TEXT
- attendees_count: INTEGER
- creator_email: TEXT
- organizer_email: TEXT
- html_link: TEXT
- hangout_link: TEXT
- raw_data: JSONB
- sync_status: TEXT
```

#### Unique Constraints
- Composite unique index on `(external_id, user_id)` to prevent duplicates
- Ensures each user's events are unique

### Database Triggers

#### auto_link_calendar_event_to_contact
- Automatically links calendar events to CRM contacts
- Matches based on organizer email
- Uses `contacts.owner_id` for ownership verification
- Fixed trigger function:
```sql
SELECT id, company_id INTO v_contact_id, v_company_id
FROM contacts
WHERE email = NEW.organizer_email
  AND owner_id = NEW.user_id  -- Fixed from user_id to owner_id
LIMIT 1;
```

### Service Layer

#### CalendarService (`/src/lib/services/calendarService.ts`)
Core service handling all calendar operations:
- **syncCalendarEvents**: Main sync orchestrator
- **getCalendarEvents**: Retrieves events from database
- **getSyncStatus**: Checks current sync operation status
- **clearStuckSyncStatus**: Cleans up stuck sync operations

Key improvements:
- Separate INSERT/UPDATE operations instead of UPSERT
- Proper error handling for database constraints
- HTML link validation and cleanup
- Comprehensive logging for debugging

### React Hooks

#### useCalendarEvents (`/src/lib/hooks/useCalendarEvents.ts`)
- Fetches calendar events from database
- Implements caching with React Query
- Handles loading and error states
- **No automatic sync** - removed `useAutoCalendarSync`

#### useGoogleIntegration (`/src/lib/hooks/useGoogleIntegration.ts`)
- Manages Google OAuth integration status
- Handles calendar service operations
- Provides sync mutation hooks
- Integrates with React Query for state management

### Frontend Components

#### Calendar Page (`/src/pages/Calendar.tsx`)
- Displays calendar events in a grid view
- Database-first approach for instant loading
- No mock data - shows real events only
- Manual sync controls with clear user feedback

## Row Level Security (RLS)

### Policy: Users can manage their own calendar events
```sql
(auth.uid() = user_id)
```
Ensures users can only access and modify their own calendar events.

## Error Handling

### Common Issues and Solutions

1. **Database Constraint Errors**
   - Issue: "no unique or exclusion constraint matching the ON CONFLICT specification"
   - Solution: Use separate INSERT/UPDATE operations instead of UPSERT

2. **Trigger Function Errors**
   - Issue: "column 'user_id' does not exist" in contacts table
   - Solution: Update trigger to use `owner_id` instead of `user_id`

3. **Invalid HTML Links**
   - Issue: Truncated URLs with "..." causing validation errors
   - Solution: Validate and clean HTML links before database insertion

## Best Practices

### Data Synchronization
1. Always start with test sync (last 7 days)
2. Verify data integrity before full historical sync
3. Use incremental sync for regular updates
4. Monitor sync logs for errors

### Performance Optimization
1. Batch event processing to reduce database calls
2. Use `maybeSingle()` instead of `single()` for existence checks
3. Remove `.select()` from insert/update operations to avoid RLS issues
4. Cache frequently accessed data with React Query

### Security Considerations
1. All operations require user authentication
2. RLS policies enforce data isolation
3. OAuth tokens stored securely in Supabase
4. No automatic background syncing

## Testing

### Manual Testing Steps
1. Navigate to `/calendar` page
2. Click "Connect Google Calendar" if not connected
3. Complete OAuth flow
4. Click "Sync Last 7 Days" for test sync
5. Verify events appear in calendar grid
6. Check console for any errors

### Automated Testing
- Unit tests for service functions
- Integration tests for database operations
- E2E tests for full sync workflow

## API Endpoints

### Supabase Edge Functions
- `google-calendar?action=sync-single` - Test sync
- `google-calendar?action=sync-incremental` - Incremental updates
- `google-calendar?action=sync-historical` - Full historical sync
- `google-calendar?action=list-events` - Retrieve events

### Database Operations
- Direct queries to `calendar_events` table
- RLS policies automatically applied
- Composite key handling for duplicates

## Migration Notes

### From Automatic to Manual Sync
- Removed all automatic sync code
- Deleted `useAutoCalendarSync` hook
- Changed default behavior to manual-only
- Updated UI to reflect manual control

### Database Schema Fixes
- Added composite unique index
- Fixed trigger function column references
- Updated RLS policies for proper access control

## Future Enhancements

### Planned Features
- Selective calendar sync (choose specific calendars)
- Event filtering options
- Two-way sync capabilities
- Conflict resolution UI
- Bulk event management

### Performance Improvements
- Implement pagination for large event sets
- Add server-side filtering
- Optimize database queries
- Implement event caching strategy

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify database triggers are properly configured
3. Ensure RLS policies are correctly set
4. Review Edge Function logs in Supabase dashboard

## References

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/v3/reference)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [React Query Documentation](https://tanstack.com/query/latest)