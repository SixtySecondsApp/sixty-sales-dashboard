# Google Calendar MCP Server

A comprehensive Model Context Protocol (MCP) server for Google Calendar integration, providing advanced scheduling, meeting management, and calendar synchronization capabilities.

## Features

### 🗓️ Core Calendar Operations
- **Event Management**: Create, update, delete, and retrieve calendar events
- **Event Listing**: Search and filter events with advanced criteria
- **All-day Events**: Support for both timed and all-day events
- **Event Details**: Rich event information including attendees, location, and reminders

### 🤝 Meeting & Scheduling
- **Smart Scheduling**: Intelligent meeting scheduling with availability checking
- **Free/Busy Lookup**: Find available time slots across multiple calendars
- **Optimal Time Finding**: AI-powered optimal meeting time suggestions
- **Meeting Rescheduling**: Easy event rescheduling with attendee notifications

### 🔄 Advanced Features
- **Recurring Events**: Create and manage recurring events with flexible patterns
- **Google Meet Integration**: Automatic Google Meet link generation
- **Time Blocking**: Block time for focus work or unavailability
- **Invitation Management**: Send invites and respond to calendar invitations

### 🔗 Integration Capabilities
- **CRM Synchronization**: Sync calendar events with CRM systems (Supabase, Salesforce, HubSpot)
- **Availability Checking**: Batch availability checking for multiple attendees
- **Conflict Detection**: Identify scheduling conflicts and suggest alternatives

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- Google Cloud Console project with Calendar API enabled
- OAuth2 credentials (Client ID and Secret)

### 2. Installation

```bash
# Clone or create the calendar-mcp directory
cd mcp-servers/calendar-mcp/

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials" 
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Select "Desktop application" as application type
   - Copy the Client ID and Client Secret

### 4. Configuration

Edit the `.env` file with your Google credentials:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
```

### 5. Build and Run

```bash
# Build the TypeScript code
npm run build

# Start the server
npm start

# Or run in development mode
npm run dev
```

## Authentication Flow

The server supports OAuth 2.0 authentication with Google. On first use:

1. Use `calendar_get_auth_url` to get the authorization URL
2. Visit the URL in your browser and grant permissions  
3. Copy the authorization code from the redirect page
4. Use `calendar_authenticate` with the code to complete authentication

Example authentication flow:

```json
// Step 1: Get auth URL
{
  "tool": "calendar_get_auth_url",
  "arguments": {}
}

// Step 2: Authenticate with code
{
  "tool": "calendar_authenticate", 
  "arguments": {
    "code": "4/0AdQt8qh..."
  }
}
```

## Available Tools

### Core Event Management

#### `calendar_create_event`
Create a new calendar event with full feature support.

```json
{
  "summary": "Team Standup",
  "description": "Daily team synchronization meeting",
  "location": "Conference Room A",
  "startDateTime": "2024-01-15T09:00:00Z",
  "endDateTime": "2024-01-15T09:30:00Z",
  "timeZone": "America/New_York",
  "attendees": [
    {
      "email": "john@company.com",
      "displayName": "John Smith",
      "optional": false
    }
  ],
  "reminders": [
    {
      "method": "email",
      "minutes": 15
    }
  ],
  "createMeetLink": true
}
```

#### `calendar_update_event`
Update an existing calendar event.

```json
{
  "eventId": "abc123def456",
  "summary": "Updated Meeting Title",
  "startDateTime": "2024-01-15T10:00:00Z",
  "endDateTime": "2024-01-15T11:00:00Z"
}
```

#### `calendar_list_events`
List calendar events with filtering options.

```json
{
  "timeMin": "2024-01-01T00:00:00Z",
  "timeMax": "2024-01-31T23:59:59Z", 
  "query": "meeting",
  "maxResults": 50,
  "orderBy": "startTime"
}
```

### Smart Scheduling

#### `calendar_find_free_slots`
Find available time slots for scheduling.

```json
{
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2024-01-19T23:59:59Z",
  "duration": 60,
  "workingHoursStart": "09:00",
  "workingHoursEnd": "17:00",
  "excludeWeekends": true
}
```

#### `calendar_schedule_meeting`
Intelligently schedule a meeting with optimal time selection.

```json
{
  "summary": "Project Review",
  "attendees": ["alice@company.com", "bob@company.com"],
  "duration": 60,
  "workingHoursStart": "09:00",
  "workingHoursEnd": "17:00",
  "createMeetLink": true
}
```

#### `calendar_find_optimal_time`
Find the optimal meeting time considering all attendees.

```json
{
  "attendees": ["alice@company.com", "bob@company.com"],
  "duration": 60,
  "dateRange": {
    "start": "2024-01-15T00:00:00Z",
    "end": "2024-01-19T23:59:59Z"
  },
  "preferences": {
    "preferMorning": true,
    "excludeWeekends": true,
    "workingHoursStart": "09:00",
    "workingHoursEnd": "17:00"
  }
}
```

### Availability & Conflict Management

#### `calendar_check_availability`
Check if attendees are available at a specific time.

```json
{
  "emails": ["alice@company.com", "bob@company.com"],
  "startDateTime": "2024-01-15T14:00:00Z",
  "endDateTime": "2024-01-15T15:00:00Z"
}
```

### Recurring Events

#### `calendar_create_recurring`
Create recurring events with flexible patterns.

```json
{
  "summary": "Weekly Team Meeting",
  "startDateTime": "2024-01-15T09:00:00Z",
  "endDateTime": "2024-01-15T10:00:00Z",
  "frequency": "WEEKLY",
  "interval": 1,
  "byDay": ["MO"],
  "count": 12,
  "attendees": ["team@company.com"]
}
```

### Time Management

#### `calendar_block_time`
Block time slots for focus work or unavailability.

```json
{
  "summary": "Focus Time - Deep Work",
  "startDateTime": "2024-01-15T09:00:00Z", 
  "endDateTime": "2024-01-15T11:00:00Z",
  "description": "Blocked for focused development work",
  "showAsBusy": true
}
```

#### `calendar_reschedule_event`
Reschedule an existing event to a new time.

```json
{
  "eventId": "abc123def456",
  "newStartDateTime": "2024-01-15T15:00:00Z",
  "newEndDateTime": "2024-01-15T16:00:00Z",
  "notifyAttendees": true
}
```

### CRM Integration

#### `calendar_sync_with_crm`
Synchronize calendar events with CRM systems.

```json
{
  "crmType": "supabase",
  "syncDirection": "bidirectional",
  "mapping": {
    "contactEmailField": "email",
    "activityTypeField": "type", 
    "descriptionField": "notes"
  }
}
```

## Error Handling

The server provides comprehensive error handling with detailed error messages:

- **Authentication Errors**: Clear guidance for OAuth setup and token refresh
- **API Errors**: Google Calendar API error details and resolution steps  
- **Validation Errors**: Input validation with specific field requirements
- **Rate Limiting**: Automatic retry logic for rate-limited requests

## Development

### Project Structure

```
calendar-mcp/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── calendar-client.ts    # Google Calendar API wrapper  
│   ├── auth/
│   │   └── oauth.ts          # OAuth 2.0 handling
│   └── tools/
│       └── index.ts          # Tool implementations
├── package.json
├── tsconfig.json
├── mcp.json                  # MCP server manifest
└── README.md
```

### Build Commands

```bash
# Development with auto-reload
npm run dev

# Production build
npm run build

# Start built server
npm start

# Clean build artifacts
npm run clean
```

### Adding Custom Tools

1. Define the tool schema in `src/tools/index.ts`
2. Add the tool to the `CALENDAR_TOOLS` array
3. Implement the handler method in `CalendarToolHandler`
4. Update the main server to route the tool call

### Testing

```bash
# Test authentication
curl -X POST http://localhost:3000/calendar_check_auth

# Test event creation
curl -X POST http://localhost:3000/calendar_create_event \
  -H "Content-Type: application/json" \
  -d '{"summary":"Test Event","startDateTime":"2024-01-15T09:00:00Z","endDateTime":"2024-01-15T10:00:00Z"}'
```

## Advanced Configuration

### Custom Scopes

The server requests these Google Calendar scopes by default:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events` 
- `https://www.googleapis.com/auth/calendar.readonly`

### Working Hours Configuration

Customize default working hours in tool calls:

```json
{
  "workingHoursStart": "08:00",
  "workingHoursEnd": "18:00", 
  "excludeWeekends": false
}
```

### Multi-Calendar Support

Most tools support specifying calendar IDs:

```json
{
  "calendarId": "primary",           // Default calendar
  "calendarId": "user@company.com",  // Specific calendar
  "calendarIds": ["cal1", "cal2"]    // Multiple calendars for free/busy
}
```

## Troubleshooting

### Common Issues

**Authentication failed**
- Verify Client ID and Secret in `.env` file
- Ensure Calendar API is enabled in Google Cloud Console
- Check that OAuth consent screen is configured

**No events returned**
- Verify calendar permissions and sharing settings
- Check date range parameters (timeMin/timeMax)
- Ensure authenticated user has access to the calendar

**Rate limiting errors**
- The server implements automatic retry with exponential backoff
- Consider reducing concurrent requests for high-volume usage

### Debug Mode

Enable debug logging:

```bash
DEBUG=calendar-mcp npm start
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

For bugs and feature requests, please open an issue with detailed information and reproduction steps.