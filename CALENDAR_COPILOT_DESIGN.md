# Calendar Copilot Design Document

## Executive Summary

This document outlines all calendar-related use cases for the AI Copilot, including tool call specifications and response layout designs. The system supports both Supabase `calendar_events`/`meetings` tables and Google Calendar API as data sources, with intelligent fallback logic.

---

## 1. Existing Capabilities Audit

### Current State

**Backend Services:**
- `calendarService.ts` - Handles Google Calendar sync, event fetching, contact linking
- `calendar_events` table - Stores synced Google Calendar events with CRM links
- `meetings` table - Stores Fathom meeting records with transcripts/summaries
- Google Calendar API integration via Edge Functions

**Copilot Tools:**
- `meetings_create`, `meetings_read`, `meetings_update`, `meetings_delete` - Full CRUD for meeting records
- No dedicated `calendar_*` tools yet

**Response Components:**
- `CalendarResponse.tsx` - Basic meeting list display with prep briefs
- `MeetingPrepResponse.tsx` - Comprehensive meeting preparation view
- Calendar response type exists in types.ts

**Gaps:**
- No calendar event search/read tools (only meetings)
- No calendar event creation/update tools
- No availability/free-busy checking
- No conflict detection
- No calendar sync status queries
- Limited date range querying

---

## 2. Calendar Use Cases

### 2.1 Read Operations

#### UC-1: Daily Agenda
**User Query:** "What's on my calendar today?", "Show me today's meetings", "What do I have scheduled?"

**Prerequisites:**
- Google Calendar integration OR synced calendar_events in database
- User authentication

**Expected Behavior:**
- Fetch events for current day (00:00 - 23:59 user timezone)
- Prioritize upcoming meetings (highlight next meeting)
- Show time until next meeting
- Display meeting links, attendees, location
- Link to CRM contacts/deals if available

**Data Sources:**
1. Primary: `calendar_events` table (filtered by `start_time` for today, `user_id`)
2. Fallback: Google Calendar API (if DB empty or stale)
3. Secondary: `meetings` table (for Fathom-recorded meetings)

**Output:**
- List of events with time, title, attendees, location
- Next meeting highlighted
- Quick actions: Join meeting, View prep brief, Reschedule

---

#### UC-2: Weekly Overview
**User Query:** "What's my schedule this week?", "Show me next week's calendar", "What meetings do I have this week?"

**Prerequisites:**
- Same as UC-1

**Expected Behavior:**
- Fetch events for specified week (Monday-Sunday or custom range)
- Group by day
- Show meeting density (busy vs free days)
- Highlight days with most meetings

**Data Sources:**
- Same as UC-1, with date range filter

**Output:**
- Day-by-day breakdown
- Summary metrics (total meetings, hours booked, free time)
- Visual calendar grid (optional)

---

#### UC-3: Meeting Search by Contact
**User Query:** "When did I last meet with Angela?", "Show me meetings with [contact name]", "What meetings do I have with [company]?"

**Prerequisites:**
- Contact/company resolution
- Calendar events linked to contacts (`contact_id` field)

**Expected Behavior:**
- Search `calendar_events` by `contact_id` or `company_id`
- Also search `meetings` table by `primary_contact_id` or `company_id`
- Sort by most recent first
- Show meeting summaries/transcripts if available

**Data Sources:**
1. `calendar_events` WHERE `contact_id = X` OR `company_id = Y`
2. `meetings` WHERE `primary_contact_id = X` OR `company_id = Y`
3. Google Calendar API search by attendee email (fallback)

**Output:**
- Chronological list of meetings
- Meeting details (date, duration, summary)
- Link to contact/company profile
- Quick actions: View transcript, Create follow-up task

---

#### UC-4: Upcoming Meetings
**User Query:** "What meetings are coming up?", "Show me my next 5 meetings", "What's scheduled for tomorrow?"

**Prerequisites:**
- Same as UC-1

**Expected Behavior:**
- Fetch future events (from now onwards)
- Limit to specified count or time range
- Sort by start time ascending
- Show time until each meeting

**Data Sources:**
- `calendar_events` WHERE `start_time >= NOW()` ORDER BY `start_time` ASC
- Google Calendar API with `timeMin=now` (fallback)

**Output:**
- List of upcoming meetings
- Countdown timers ("in 2 hours", "tomorrow at 10am")
- Prep brief availability indicators
- Quick actions: View prep, Reschedule, Cancel

---

#### UC-5: Meeting History
**User Query:** "What meetings did I have last week?", "Show me past meetings", "What did I do last month?"

**Prerequisites:**
- Same as UC-1

**Expected Behavior:**
- Fetch past events within date range
- Include meeting summaries/transcripts if available
- Show action items from meetings
- Link to related deals/contacts

**Data Sources:**
- `calendar_events` WHERE `start_time < NOW()` AND `start_time >= startDate`
- `meetings` table for transcripts/summaries

**Output:**
- Chronological list of past meetings
- Meeting outcomes (if summary exists)
- Action items extracted
- Quick actions: View transcript, View deal, Create follow-up

---

#### UC-6: Free/Busy Check
**User Query:** "When am I free this week?", "What times am I available?", "Find a free slot"

**Prerequisites:**
- Calendar events synced
- User timezone configured

**Expected Behavior:**
- Calculate free time slots between events
- Show available blocks (30min, 1hr, 2hr windows)
- Highlight best times for meetings
- Consider working hours (9am-5pm default)

**Data Sources:**
- `calendar_events` for date range
- Calculate gaps between events
- Filter by working hours

**Output:**
- List of free time slots
- Visual timeline (optional)
- Suggested meeting times
- Quick actions: Schedule meeting, Block time

---

#### UC-7: Meeting Details
**User Query:** "Tell me about my meeting with [contact]", "What's the agenda for [meeting title]?", "Show me details for [meeting]"

**Prerequisites:**
- Meeting ID or unique identifier
- Meeting record exists

**Expected Behavior:**
- Fetch full meeting details
- Include attendees, location, description
- Show prep brief if available
- Link to CRM records

**Data Sources:**
- `calendar_events` OR `meetings` by ID
- Join with contacts, companies, deals

**Output:**
- Full meeting card with all details
- Attendee list with roles
- Meeting link/join button
- Prep brief section
- Related CRM data

---

#### UC-8: Calendar Sync Status
**User Query:** "Is my calendar synced?", "When was my calendar last updated?", "Sync my calendar"

**Prerequisites:**
- Google Calendar integration configured
- Sync logs available

**Expected Behavior:**
- Check last sync timestamp
- Show sync status (synced, pending, error)
- Display sync statistics (events created/updated)
- Option to trigger manual sync

**Data Sources:**
- `calendar_sync_logs` table
- `calendar_calendars.historical_sync_completed`

**Output:**
- Sync status card
- Last synced timestamp
- Sync statistics
- Manual sync button

---

### 2.2 Write Operations

#### UC-9: Create Meeting
**User Query:** "Schedule a meeting with [contact] next Tuesday at 2pm", "Create a meeting for [date/time]", "Book a call with [name]"

**Prerequisites:**
- Contact resolution
- Date/time parsing
- Google Calendar write permissions

**Expected Behavior:**
- Parse meeting details (title, date, time, attendees, duration)
- Check for conflicts
- Create event in Google Calendar
- Store in `calendar_events` table
- Link to contact/company if specified
- Send calendar invites

**Data Sources:**
- Google Calendar API (create event)
- `calendar_events` table (insert record)
- `contacts` table (for attendee resolution)

**Output:**
- Confirmation message
- Created event details
- Calendar link
- Quick actions: Edit, Cancel, Add to CRM deal

---

#### UC-10: Reschedule Meeting
**User Query:** "Move my meeting with [contact] to tomorrow", "Reschedule [meeting] to [new time]", "Change [meeting] time"

**Prerequisites:**
- Meeting identification
- New time specified
- Conflict checking

**Expected Behavior:**
- Find meeting by title/contact/time
- Check for conflicts at new time
- Update Google Calendar event
- Update `calendar_events` record
- Notify attendees (via Google Calendar)

**Data Sources:**
- Google Calendar API (update event)
- `calendar_events` table (update record)

**Output:**
- Confirmation with old/new times
- Updated event link
- Conflict warnings if any

---

#### UC-11: Cancel Meeting
**User Query:** "Cancel my meeting with [contact]", "Delete [meeting]", "Remove [meeting] from calendar"

**Prerequisites:**
- Meeting identification
- User has permission to cancel

**Expected Behavior:**
- Find meeting
- Delete from Google Calendar
- Mark as cancelled in `calendar_events` (soft delete)
- Notify attendees

**Data Sources:**
- Google Calendar API (delete event)
- `calendar_events` table (update status to 'cancelled')

**Output:**
- Confirmation message
- Cancelled meeting details
- Option to reschedule

---

#### UC-12: Update Meeting Details
**User Query:** "Add [attendee] to [meeting]", "Change [meeting] location to [location]", "Update [meeting] description"

**Prerequisites:**
- Meeting identification
- Field to update specified

**Expected Behavior:**
- Find meeting
- Update specific field(s)
- Sync to Google Calendar
- Update database record

**Data Sources:**
- Google Calendar API (patch event)
- `calendar_events` table (update record)

**Output:**
- Confirmation with changes
- Updated event details

---

#### UC-13: Create Follow-up Meeting
**User Query:** "Schedule a follow-up with [contact]", "Book a follow-up meeting", "Set up next meeting"

**Prerequisites:**
- Contact resolution
- Previous meeting context (optional)

**Expected Behavior:**
- Suggest follow-up time (e.g., 1 week after last meeting)
- Pre-fill meeting title ("Follow-up: [contact name]")
- Link to previous meeting/deal
- Create in Google Calendar
- Store in database

**Data Sources:**
- Previous meeting data (for timing suggestions)
- Google Calendar API (create event)
- `calendar_events` table

**Output:**
- Created follow-up meeting
- Link to previous meeting
- Suggested agenda items

---

#### UC-14: Block Time
**User Query:** "Block my calendar for [time]", "Mark [time] as busy", "Create a focus block"

**Prerequisites:**
- Time range specified
- No conflicts (optional check)

**Expected Behavior:**
- Create "busy" event in Google Calendar
- Mark as "opaque" (shows as busy)
- Store in `calendar_events` with special flag
- No attendees (personal block)

**Data Sources:**
- Google Calendar API (create event with `transparency: 'opaque'`)
- `calendar_events` table

**Output:**
- Confirmation
- Blocked time slot details
- Option to convert to meeting

---

### 2.3 Advanced Operations

#### UC-15: Conflict Detection
**User Query:** "Do I have any conflicts?", "Check for scheduling conflicts", "Am I double-booked?"

**Prerequisites:**
- Calendar events synced
- Overlapping events detection

**Expected Behavior:**
- Find overlapping events (same time slot)
- Flag potential conflicts
- Suggest resolutions
- Show conflicting events

**Data Sources:**
- `calendar_events` WHERE overlapping `start_time`/`end_time`
- Google Calendar API freebusy query (more accurate)

**Output:**
- List of conflicts
- Conflicting events side-by-side
- Resolution suggestions

---

#### UC-16: Meeting Prep Generation
**User Query:** "Prepare me for my meeting with [contact]", "What should I know before [meeting]?", "Generate prep brief"

**Prerequisites:**
- Meeting identified
- Contact/deal data available
- Previous interactions accessible

**Expected Behavior:**
- Fetch contact/deal context
- Pull recent emails/activities
- Generate talking points
- Extract action items from previous meetings
- Create prep brief

**Data Sources:**
- `meetings` table (for prep brief generation)
- `contacts`, `deals`, `activities` tables
- Email history (via Gmail API)

**Output:**
- Comprehensive prep brief (see MeetingPrepResponse)
- Talking points
- Discovery questions
- Risks/opportunities
- Action items

---

#### UC-17: Find Meeting Time
**User Query:** "When can I meet with [contact]?", "Find a time for [meeting]", "Suggest meeting times"

**Prerequisites:**
- User calendar synced
- Contact calendar (optional, if shared)

**Expected Behavior:**
- Analyze user's free time
- Consider contact's availability (if accessible)
- Suggest optimal time slots
- Account for timezone differences
- Respect working hours

**Data Sources:**
- `calendar_events` for user
- Google Calendar freebusy API (for contact, if shared)
- Working hours configuration

**Output:**
- List of suggested time slots
- Availability visualization
- Quick actions: Schedule at [time]

---

#### UC-18: Meeting Summary
**User Query:** "Summarize my meetings this week", "What happened in my meetings?", "Meeting recap"

**Prerequisites:**
- Meetings with summaries/transcripts
- Date range specified

**Expected Behavior:**
- Fetch meetings in range
- Extract key points from summaries
- List action items
- Show meeting outcomes
- Link to deals/contacts

**Data Sources:**
- `meetings` table (summaries/transcripts)
- `calendar_events` (basic info)
- `meeting_action_items` table

**Output:**
- Summary of all meetings
- Key takeaways
- Action items list
- Follow-up suggestions

---

## 3. Tool Call Specifications

### 3.1 Calendar Read Tools

#### Tool: `calendar_search`
**Purpose:** Search and retrieve calendar events with flexible filtering

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    startDate: { 
      type: 'string', 
      description: 'Start date filter (ISO format). Defaults to today if not provided.' 
    },
    endDate: { 
      type: 'string', 
      description: 'End date filter (ISO format). Defaults to end of startDate day if not provided.' 
    },
    contactId: { 
      type: 'string', 
      description: 'Filter by contact ID' 
    },
    contactEmail: { 
      type: 'string', 
      description: 'Filter by contact email (resolves to contact_id)' 
    },
    companyId: { 
      type: 'string', 
      description: 'Filter by company ID' 
    },
    title: { 
      type: 'string', 
      description: 'Search in event titles (case-insensitive)' 
    },
    limit: { 
      type: 'number', 
      default: 50, 
      description: 'Maximum number of events to return' 
    },
    includePast: { 
      type: 'boolean', 
      default: false, 
      description: 'Include past events (default: future only)' 
    },
    source: { 
      type: 'string', 
      enum: ['database', 'google', 'both'], 
      default: 'both',
      description: 'Data source preference. "both" tries database first, falls back to Google.' 
    }
  }
}
```

**Handler Logic:**
1. Resolve `contactEmail` → `contactId` if provided
2. Query `calendar_events` table with filters
3. If no results and `source` includes 'google', query Google Calendar API
4. Merge and deduplicate results
5. Sort by `start_time` ascending
6. Return event summaries

**Output Format:**
```typescript
{
  success: true,
  events: Array<{
    id: string,
    external_id: string | null,
    title: string,
    start_time: string,
    end_time: string,
    location: string | null,
    meeting_url: string | null,
    attendees_count: number,
    contact_id: string | null,
    contact_name: string | null,
    company_id: string | null,
    company_name: string | null,
    html_link: string | null,
    description: string | null
  }>,
  source: 'database' | 'google' | 'both',
  count: number
}
```

---

#### Tool: `calendar_availability`
**Purpose:** Check free/busy status and find available time slots

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    startDate: { 
      type: 'string', 
      description: 'Start of availability window (ISO format). Defaults to now.' 
    },
    endDate: { 
      type: 'string', 
      description: 'End of availability window (ISO format). Defaults to 7 days from startDate.' 
    },
    durationMinutes: { 
      type: 'number', 
      default: 60, 
      description: 'Required duration for meeting slot in minutes' 
    },
    workingHoursStart: { 
      type: 'string', 
      default: '09:00', 
      description: 'Start of working hours (HH:mm format)' 
    },
    workingHoursEnd: { 
      type: 'string', 
      default: '17:00', 
      description: 'End of working hours (HH:mm format)' 
    },
    excludeWeekends: { 
      type: 'boolean', 
      default: true, 
      description: 'Exclude weekends from availability' 
    }
  }
}
```

**Handler Logic:**
1. Fetch all events in date range from `calendar_events`
2. Calculate free time blocks between events
3. Filter by working hours and duration
4. Exclude weekends if specified
5. Sort by start time
6. Return available slots

**Output Format:**
```typescript
{
  success: true,
  availableSlots: Array<{
    start: string,
    end: string,
    durationMinutes: number
  }>,
  busySlots: Array<{
    start: string,
    end: string,
    title: string
  }>,
  summary: {
    totalFreeHours: number,
    totalBusyHours: number,
    meetingCount: number
  }
}
```

---

#### Tool: `calendar_conflicts`
**Purpose:** Detect scheduling conflicts and overlapping events

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    startDate: { 
      type: 'string', 
      description: 'Start of conflict check window (ISO format)' 
    },
    endDate: { 
      type: 'string', 
      description: 'End of conflict check window (ISO format)' 
    }
  }
}
```

**Handler Logic:**
1. Fetch all events in date range
2. Detect overlapping time slots
3. Group conflicts by time window
4. Return conflict details

**Output Format:**
```typescript
{
  success: true,
  conflicts: Array<{
    start: string,
    end: string,
    events: Array<{
      id: string,
      title: string,
      start_time: string,
      end_time: string
    }>
  }>,
  conflictCount: number
}
```

---

### 3.2 Calendar Write Tools

#### Tool: `calendar_create`
**Purpose:** Create a new calendar event in Google Calendar and database

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    title: { 
      type: 'string', 
      description: 'Event title (required)' 
    },
    startTime: { 
      type: 'string', 
      description: 'Start time (ISO format, required)' 
    },
    endTime: { 
      type: 'string', 
      description: 'End time (ISO format, required)' 
    },
    description: { 
      type: 'string', 
      description: 'Event description' 
    },
    location: { 
      type: 'string', 
      description: 'Event location' 
    },
    attendees: { 
      type: 'array', 
      items: { type: 'string' }, 
      description: 'Array of attendee email addresses' 
    },
    contactId: { 
      type: 'string', 
      description: 'Link to CRM contact' 
    },
    companyId: { 
      type: 'string', 
      description: 'Link to CRM company' 
    },
    dealId: { 
      type: 'string', 
      description: 'Link to CRM deal' 
    },
    checkConflicts: { 
      type: 'boolean', 
      default: true, 
      description: 'Check for conflicts before creating' 
    },
    sendInvites: { 
      type: 'boolean', 
      default: true, 
      description: 'Send calendar invites to attendees' 
    }
  },
  required: ['title', 'startTime', 'endTime']
}
```

**Handler Logic:**
1. Validate required fields
2. Check for conflicts if `checkConflicts` is true
3. Create event in Google Calendar via API
4. Store in `calendar_events` table
5. Link to contact/company/deal if provided
6. Send invites if `sendInvites` is true
7. Return created event details

**Output Format:**
```typescript
{
  success: true,
  event: {
    id: string,
    external_id: string,
    title: string,
    start_time: string,
    end_time: string,
    html_link: string,
    meeting_url: string | null
  },
  conflicts: Array<{...}> | null,
  message: string
}
```

---

#### Tool: `calendar_update`
**Purpose:** Update an existing calendar event

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      description: 'Event ID (database ID or external_id)' 
    },
    title: { type: 'string' },
    startTime: { type: 'string' },
    endTime: { type: 'string' },
    description: { type: 'string' },
    location: { type: 'string' },
    attendees: { 
      type: 'array', 
      items: { type: 'string' } 
    },
    checkConflicts: { 
      type: 'boolean', 
      default: true 
    }
  },
  required: ['id']
}
```

**Handler Logic:**
1. Find event by ID (try database first, then external_id)
2. Check conflicts if time changed and `checkConflicts` is true
3. Update in Google Calendar
4. Update `calendar_events` record
5. Return updated event

**Output Format:**
```typescript
{
  success: true,
  event: {...},
  conflicts: Array<{...}> | null,
  message: string
}
```

---

#### Tool: `calendar_delete`
**Purpose:** Cancel/delete a calendar event

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      description: 'Event ID (required)' 
    },
    notifyAttendees: { 
      type: 'boolean', 
      default: true, 
      description: 'Send cancellation notices' 
    }
  },
  required: ['id']
}
```

**Handler Logic:**
1. Find event by ID
2. Delete from Google Calendar
3. Update `calendar_events` status to 'cancelled' (soft delete)
4. Send cancellation notices if requested
5. Return confirmation

**Output Format:**
```typescript
{
  success: true,
  message: string,
  cancelledEvent: {
    id: string,
    title: string,
    start_time: string
  }
}
```

---

#### Tool: `calendar_sync_status`
**Purpose:** Check calendar sync status and trigger sync if needed

**Input Schema:**
```typescript
{
  type: 'object',
  properties: {
    triggerSync: { 
      type: 'boolean', 
      default: false, 
      description: 'Trigger manual sync if true' 
    },
    syncType: { 
      type: 'string', 
      enum: ['incremental', 'full', 'historical'], 
      default: 'incremental',
      description: 'Type of sync to trigger' 
    }
  }
}
```

**Handler Logic:**
1. Query `calendar_sync_logs` for last sync
2. Check `calendar_calendars.historical_sync_completed`
3. If `triggerSync` is true, call calendar sync Edge Function
4. Return sync status

**Output Format:**
```typescript
{
  success: true,
  status: {
    isSynced: boolean,
    lastSyncedAt: string | null,
    eventsCreated: number,
    eventsUpdated: number,
    eventsDeleted: number,
    error: string | null,
    historicalSyncCompleted: boolean
  }
}
```

---

## 4. Response Layout Designs

### 4.1 Daily Agenda Response (`calendar_agenda`)

**Component:** `AgendaResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ 📅 Today's Agenda                   │
│ [Summary text]                       │
├─────────────────────────────────────┤
│ ⏰ Next Meeting: [Title]            │
│    In 2 hours • [Time]              │
│    [Join] [Prep] [Reschedule]        │
├─────────────────────────────────────┤
│ 📋 Today's Meetings (5)             │
│ ┌─────────────────────────────────┐ │
│ │ 09:00 - 10:00                   │ │
│ │ [Title]                         │ │
│ │ 👥 [Attendees]                  │ │
│ │ 📍 [Location]                   │ │
│ │ [Join] [Details]                │ │
│ └─────────────────────────────────┘ │
│ ... (more meetings)                  │
├─────────────────────────────────────┤
│ 📊 Summary                          │
│ • 5 meetings • 6 hours booked        │
│ • 2 hours free                       │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_agenda',
  summary: "You have 5 meetings today, starting with [next meeting] in 2 hours.",
  data: {
    date: string,
    nextMeeting: {
      id: string,
      title: string,
      startTime: string,
      endTime: string,
      minutesUntil: number,
      attendees: Array<{name: string, email: string}>,
      location: string | null,
      meetingUrl: string | null,
      hasPrepBrief: boolean
    },
    meetings: Array<{
      id: string,
      title: string,
      startTime: string,
      endTime: string,
      attendees: Array<{...}>,
      location: string | null,
      meetingUrl: string | null,
      contactId: string | null,
      contactName: string | null,
      hasPrepBrief: boolean
    }>,
    summary: {
      totalMeetings: number,
      hoursBooked: number,
      hoursFree: number,
      nextMeetingIn: string
    }
  },
  actions: [
    {id: 'join-next', label: 'Join Next Meeting', callback: '...'},
    {id: 'view-prep', label: 'View Prep Brief', callback: '...'},
    {id: 'sync-calendar', label: 'Sync Calendar', callback: '...'}
  ]
}
```

---

### 4.2 Weekly Overview Response (`calendar_weekly`)

**Component:** `WeeklyCalendarResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ 📅 Week of [Date]                   │
│ [Summary text]                      │
├─────────────────────────────────────┤
│ Mon  │ Tue  │ Wed  │ Thu  │ Fri     │
│ ──── │ ──── │ ──── │ ──── │ ────   │
│ 3 mt │ 2 mt │ 5 mt │ 1 mt │ 0 mt   │
│ [3]  │ [2]  │ [5]  │ [1]  │ [0]    │
│      │      │ ⚠️   │      │        │
│      │      │ Busy │      │        │
├─────────────────────────────────────┤
│ 📊 Weekly Summary                    │
│ • 11 meetings total                  │
│ • 22 hours booked                    │
│ • Wednesday is busiest               │
│ • Friday is free                     │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_weekly',
  summary: "You have 11 meetings this week, with Wednesday being your busiest day.",
  data: {
    weekStart: string,
    weekEnd: string,
    days: Array<{
      date: string,
      dayName: string,
      meetings: Array<{...}>,
      meetingCount: number,
      hoursBooked: number,
      isBusy: boolean
    }>,
    summary: {
      totalMeetings: number,
      totalHoursBooked: number,
      busiestDay: string,
      freeDay: string
    }
  }
}
```

---

### 4.3 Meeting Search Response (`calendar_meeting_search`)

**Component:** `MeetingSearchResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ 🔍 Meetings with [Contact]          │
│ Found 8 meetings                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Dec 15, 2024 • 2:00 PM          │ │
│ │ [Meeting Title]                  │ │
│ │ 📝 Summary: [excerpt]            │ │
│ │ ✅ 3 action items                │ │
│ │ [View] [Transcript] [Deal]       │ │
│ └─────────────────────────────────┘ │
│ ... (more meetings)                  │
├─────────────────────────────────────┤
│ 📊 Summary                          │
│ • 8 total meetings                   │
│ • Last meeting: 2 weeks ago         │
│ • Average duration: 45 min          │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_meeting_search',
  summary: "Found 8 meetings with [contact name].",
  data: {
    contactId: string | null,
    contactName: string | null,
    companyId: string | null,
    companyName: string | null,
    meetings: Array<{
      id: string,
      title: string,
      startTime: string,
      endTime: string,
      durationMinutes: number,
      summary: string | null,
      hasTranscript: boolean,
      actionItemsCount: number,
      dealId: string | null,
      dealName: string | null
    }>,
    summary: {
      totalMeetings: number,
      lastMeetingDate: string | null,
      averageDuration: number,
      totalActionItems: number
    }
  },
  actions: [
    {id: 'schedule-followup', label: 'Schedule Follow-up', callback: '...'},
    {id: 'view-contact', label: 'View Contact', callback: '...'}
  ]
}
```

---

### 4.4 Availability Response (`calendar_availability`)

**Component:** `AvailabilityResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ ⏰ Your Availability                 │
│ [Date range]                         │
├─────────────────────────────────────┤
│ 📅 Available Time Slots              │
│ ┌─────────────────────────────────┐ │
│ │ Today, 2:00 PM - 3:00 PM         │ │
│ │ [1 hour] • Perfect for meetings  │ │
│ │ [Schedule]                       │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Tomorrow, 10:00 AM - 12:00 PM   │ │
│ │ [2 hours] • Great for deep work  │ │
│ │ [Schedule]                       │ │
│ └─────────────────────────────────┘ │
│ ... (more slots)                    │
├─────────────────────────────────────┤
│ 📊 Summary                          │
│ • 12 hours free this week            │
│ • 8 hours booked                     │
│ • Best availability: Friday          │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_availability',
  summary: "You have 12 hours of free time this week. Here are the best slots for meetings.",
  data: {
    startDate: string,
    endDate: string,
    availableSlots: Array<{
      start: string,
      end: string,
      durationMinutes: number,
      quality: 'excellent' | 'good' | 'ok' // Based on duration, time of day
    }>,
    busySlots: Array<{
      start: string,
      end: string,
      title: string
    }>,
    summary: {
      totalFreeHours: number,
      totalBusyHours: number,
      meetingCount: number,
      bestDay: string
    }
  },
  actions: [
    {id: 'schedule-meeting', label: 'Schedule Meeting', callback: '...'},
    {id: 'block-time', label: 'Block Time', callback: '...'}
  ]
}
```

---

### 4.5 Meeting Creation Response (`calendar_meeting_created`)

**Component:** `MeetingCreatedResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ ✅ Meeting Scheduled                │
│ [Meeting title]                     │
├─────────────────────────────────────┤
│ 📅 [Date] at [Time]                 │
│ 👥 [Attendees list]                 │
│ 📍 [Location]                       │
│ 🔗 [Calendar link]                  │
├─────────────────────────────────────┤
│ ⚠️ Conflicts Detected (optional)    │
│ • [Conflicting event]                │
│ [Resolve]                            │
├─────────────────────────────────────┤
│ [Edit] [Cancel] [Add to Deal]        │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_meeting_created',
  summary: "Successfully scheduled meeting '[title]' on [date] at [time].",
  data: {
    event: {
      id: string,
      external_id: string,
      title: string,
      startTime: string,
      endTime: string,
      location: string | null,
      meetingUrl: string | null,
      htmlLink: string,
      attendees: Array<{...}>
    },
    conflicts: Array<{...}> | null,
    linkedContact: {
      id: string,
      name: string
    } | null,
    linkedDeal: {
      id: string,
      name: string
    } | null
  },
  actions: [
    {id: 'edit-meeting', label: 'Edit Meeting', callback: '...'},
    {id: 'cancel-meeting', label: 'Cancel', callback: '...'},
    {id: 'view-calendar', label: 'View in Calendar', callback: '...'}
  ]
}
```

---

### 4.6 Conflict Detection Response (`calendar_conflicts`)

**Component:** `ConflictResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ ⚠️ Scheduling Conflicts Detected    │
│ Found 2 conflicts                    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Dec 20, 2:00 PM - 3:00 PM       │ │
│ │ Conflict:                       │ │
│ │ • [Meeting 1]                   │ │
│ │ • [Meeting 2]                   │ │
│ │ [Resolve] [Keep Both]           │ │
│ └─────────────────────────────────┘ │
│ ... (more conflicts)                │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_conflicts',
  summary: "Found 2 scheduling conflicts that need attention.",
  data: {
    conflicts: Array<{
      start: string,
      end: string,
      events: Array<{
        id: string,
        title: string,
        startTime: string,
        endTime: string,
        attendees: Array<{...}>
      }>
    }>,
    conflictCount: number
  },
  actions: [
    {id: 'resolve-conflict', label: 'Resolve Conflicts', callback: '...'}
  ]
}
```

---

### 4.7 Sync Status Response (`calendar_sync_status`)

**Component:** `SyncStatusResponse.tsx` (new)

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ 🔄 Calendar Sync Status             │
│ ✅ Last synced: 5 minutes ago        │
├─────────────────────────────────────┤
│ 📊 Sync Statistics                   │
│ • 245 events synced                 │
│ • 12 events created today            │
│ • 3 events updated                   │
│ • Historical sync: ✅ Complete      │
├─────────────────────────────────────┤
│ [Sync Now] [View Calendar]          │
└─────────────────────────────────────┘
```

**Data Structure:**
```typescript
{
  type: 'calendar_sync_status',
  summary: "Your calendar is synced. Last updated 5 minutes ago.",
  data: {
    status: {
      isSynced: boolean,
      lastSyncedAt: string | null,
      eventsCreated: number,
      eventsUpdated: number,
      eventsDeleted: number,
      historicalSyncCompleted: boolean,
      error: string | null
    }
  },
  actions: [
    {id: 'sync-now', label: 'Sync Now', callback: '...'},
    {id: 'view-calendar', label: 'View Calendar', callback: '...'}
  ]
}
```

---

## 5. Integration Notes

### 5.1 Backend Requirements

**New Edge Function Handlers:**
- `handleCalendarTool()` - Routes calendar tool calls
- `searchCalendarEvents()` - Database + Google Calendar search
- `checkAvailability()` - Free/busy calculation
- `createCalendarEvent()` - Google Calendar API + database insert
- `updateCalendarEvent()` - Google Calendar API + database update
- `deleteCalendarEvent()` - Google Calendar API + soft delete
- `detectConflicts()` - Overlap detection
- `getSyncStatus()` - Sync log querying

**Google Calendar API Integration:**
- OAuth token management (reuse existing `getGmailAccessToken` pattern)
- Event CRUD operations
- Freebusy queries for availability
- Attendee management
- Recurrence handling

**Database Queries:**
- Efficient date range queries on `calendar_events`
- Contact/company joins for filtering
- Conflict detection via overlapping time ranges
- Sync log tracking

### 5.2 Frontend Requirements

**New Response Components:**
- `AgendaResponse.tsx` - Daily agenda view
- `WeeklyCalendarResponse.tsx` - Weekly overview
- `MeetingSearchResponse.tsx` - Meeting search results
- `AvailabilityResponse.tsx` - Free time slots
- `MeetingCreatedResponse.tsx` - Creation confirmation
- `ConflictResponse.tsx` - Conflict detection
- `SyncStatusResponse.tsx` - Sync status display

**Type Definitions:**
- Add new response types to `types.ts`:
  - `calendar_agenda`
  - `calendar_weekly`
  - `calendar_meeting_search`
  - `calendar_availability`
  - `calendar_meeting_created`
  - `calendar_conflicts`
  - `calendar_sync_status`

**Tool Animation:**
- Add `calendar_search` to `toolTypes.ts`
- Add animation steps to `useToolCall.ts`
- Add tool config to `ToolCallIndicator.tsx`

### 5.3 Data Source Fallback Logic

**Priority Order:**
1. **Database First** - Query `calendar_events` table (fastest, most reliable)
2. **Google Calendar Fallback** - If DB empty/stale or specific query needs live data
3. **Merge Results** - Combine both sources, deduplicate by `external_id`

**Staleness Detection:**
- If last sync > 1 hour ago, prefer Google Calendar API
- For write operations, always use Google Calendar API + update DB
- For read operations, prefer DB but validate with Google if needed

### 5.4 Error Handling

**Common Scenarios:**
- Google Calendar API unavailable → Use database only, show warning
- Database empty → Trigger sync, use Google API in meantime
- Token expired → Auto-refresh, retry operation
- Conflict detected → Show conflicts, offer resolution options
- Permission denied → Show error, suggest re-authentication

---

## 6. Testing Strategy

### 6.1 Unit Tests
- Tool handler functions (search, create, update, delete)
- Conflict detection logic
- Availability calculation
- Date range parsing
- Contact/company resolution

### 6.2 Integration Tests
- Google Calendar API integration
- Database sync operations
- Fallback logic between sources
- Error recovery scenarios

### 6.3 Manual Testing Flows
1. **Daily Agenda:** Query today's meetings, verify next meeting highlighting
2. **Create Meeting:** Schedule meeting, verify Google Calendar + database
3. **Conflict Detection:** Create overlapping events, verify conflict detection
4. **Availability:** Check free time, verify working hours filtering
5. **Sync Status:** Check sync logs, trigger manual sync
6. **Meeting Search:** Search by contact, verify results and linking

---

## 7. Implementation Phases

### Phase 1: Read Operations (Week 1)
- Implement `calendar_search` tool
- Create `AgendaResponse` component
- Create `MeetingSearchResponse` component
- Add intent detection for calendar queries
- Test with existing calendar data

### Phase 2: Write Operations (Week 2)
- Implement `calendar_create` tool
- Implement `calendar_update` tool
- Implement `calendar_delete` tool
- Create `MeetingCreatedResponse` component
- Test Google Calendar API integration

### Phase 3: Advanced Features (Week 3)
- Implement `calendar_availability` tool
- Implement `calendar_conflicts` tool
- Create `AvailabilityResponse` component
- Create `ConflictResponse` component
- Add conflict resolution flows

### Phase 4: Polish & Optimization (Week 4)
- Implement `calendar_sync_status` tool
- Create `SyncStatusResponse` component
- Optimize database queries
- Add caching for frequent queries
- Performance testing and optimization

---

## 8. Success Metrics

- **Query Response Time:** < 500ms for database queries, < 2s for Google API
- **Accuracy:** 100% conflict detection, 95%+ availability calculation accuracy
- **User Satisfaction:** Users can schedule meetings via natural language
- **Sync Reliability:** 99%+ sync success rate, < 5min sync lag

---

## Appendix: Tool Call Examples

### Example 1: Daily Agenda
```
User: "What's on my calendar today?"
Tool: calendar_search({ startDate: "2025-01-15T00:00:00Z", endDate: "2025-01-15T23:59:59Z", includePast: false })
Response: calendar_agenda
```

### Example 2: Create Meeting
```
User: "Schedule a meeting with Angela next Tuesday at 2pm"
Tool: calendar_create({ title: "Meeting with Angela", startTime: "2025-01-21T14:00:00Z", endTime: "2025-01-21T15:00:00Z", contactId: "..." })
Response: calendar_meeting_created
```

### Example 3: Check Availability
```
User: "When am I free this week?"
Tool: calendar_availability({ startDate: "2025-01-15T00:00:00Z", endDate: "2025-01-21T23:59:59Z", durationMinutes: 60 })
Response: calendar_availability
```

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Ready for Implementation



























