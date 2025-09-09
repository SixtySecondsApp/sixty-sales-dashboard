# Google Workspace Integration Documentation

## Overview

This integration enables seamless connectivity with Google Workspace services including Google Docs, Drive, Gmail, and Calendar. The integration supports OAuth 2.0 authentication, token management, and provides workflow nodes for automation.

## Features

### 🔐 OAuth Integration
- Secure OAuth 2.0 authentication flow
- Automatic token refresh mechanism
- Multi-user support with Row Level Security
- Scope verification for service access

### 📄 Google Docs
- Create formatted documents from templates
- Variable replacement ({{variable}} syntax)
- Support for headings, paragraphs, lists, tables, and images
- Export documents as PDF
- Template management system

### 📁 Google Drive
- Create folders and organize files
- Upload files with optional conversion to Google formats
- Search and list files
- Share files and create public links
- Move and copy files between folders

### 📧 Gmail
- Send emails with HTML formatting
- Support for CC/BCC recipients
- Email attachments
- Create and manage drafts
- Reply to threads
- Label management

### 📅 Google Calendar
- Create and manage events
- Send meeting invitations
- Check free/busy time
- Recurring events support
- Quick add using natural language

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Docs API
   - Google Drive API
   - Gmail API
   - Google Calendar API

### 2. OAuth Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - Development: `http://localhost:5173/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
5. Copy the Client ID and Client Secret

### 3. Environment Configuration

Add the following to your `.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

### 4. Database Migration

Run the Google Workspace migration to create necessary tables:

```sql
-- Execute the migration file:
supabase/migrations/20250110_google_workspace_integration.sql
```

## Usage

### Connecting Google Workspace

1. Navigate to Admin Panel > Google Workspace Settings
2. Click "Connect Google Workspace"
3. Authorize the requested permissions
4. Integration will be saved automatically

### Workflow Node Configuration

#### Create Google Doc Node

```javascript
{
  tool: "create_google_doc",
  parameters: {
    title: "{{dealName}} Proposal",
    content: [
      {
        type: "heading",
        text: "Proposal for {{companyName}}",
        level: 1
      },
      {
        type: "paragraph",
        text: "Dear {{contactName}},",
        style: { bold: true }
      },
      {
        type: "list",
        items: ["Item 1", "Item 2", "Item 3"]
      }
    ],
    folderId: "optional_folder_id",
    variables: {
      dealName: "{{deal.name}}",
      companyName: "{{company.name}}",
      contactName: "{{contact.name}}"
    }
  }
}
```

#### Send Gmail Node

```javascript
{
  tool: "send_gmail",
  parameters: {
    to: ["{{contact.email}}"],
    subject: "Proposal for {{deal.name}}",
    body: "Please find attached the proposal document.",
    isHtml: true,
    cc: ["manager@company.com"],
    variables: {
      "deal.name": "{{deal.name}}",
      "contact.name": "{{contact.name}}"
    }
  }
}
```

#### Create Calendar Event Node

```javascript
{
  tool: "create_calendar_event",
  parameters: {
    summary: "Meeting with {{contact.name}}",
    startDateTime: "2025-01-15T10:00:00-05:00",
    endDateTime: "2025-01-15T11:00:00-05:00",
    description: "Discuss proposal for {{deal.name}}",
    location: "Conference Room A",
    attendees: ["{{contact.email}}"]
  }
}
```

## API Reference

### Services

#### GoogleOAuthService
- `getAuthorizationUrl(state?: string): string`
- `exchangeCodeForTokens(code: string): Promise<TokenResponse>`
- `refreshAccessToken(userId: string): Promise<Credentials>`
- `getAuthenticatedClient(userId: string): Promise<OAuth2Client>`
- `hasValidIntegration(userId: string): Promise<boolean>`

#### GoogleDocsService
- `createDocument(userId, template, folderId?): Promise<DocumentResponse>`
- `getDocument(userId, documentId): Promise<Document>`
- `updateDocument(userId, documentId, requests): Promise<UpdateResponse>`
- `exportAsPdf(userId, documentId): Promise<Buffer>`

#### GoogleGmailService
- `sendEmail(userId, message): Promise<string>`
- `getEmails(userId, filter): Promise<EmailList>`
- `createDraft(userId, message): Promise<string>`
- `replyToThread(userId, threadId, message): Promise<string>`

#### GoogleCalendarService
- `createEvent(userId, event, calendarId): Promise<string>`
- `getEvents(userId, filter): Promise<Event[]>`
- `updateEvent(userId, eventId, event): Promise<Event>`
- `deleteEvent(userId, eventId): Promise<void>`

#### GoogleDriveService
- `createFolder(userId, name, parentId?): Promise<string>`
- `uploadFile(userId, metadata, content): Promise<FileResponse>`
- `downloadFile(userId, fileId): Promise<Buffer>`
- `listFiles(userId, filter): Promise<FileList>`
- `shareFile(userId, fileId, email, role): Promise<Permission>`

## Security Considerations

### Data Protection
- All tokens are encrypted at rest in the database
- Row Level Security ensures users can only access their own integrations
- Refresh tokens are securely stored and never exposed to the client

### Permission Scopes
The integration requests the following scopes:
- `https://www.googleapis.com/auth/documents` - Create and edit Google Docs
- `https://www.googleapis.com/auth/drive` - Full Drive access
- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/calendar` - Manage calendar events
- `https://www.googleapis.com/auth/userinfo.email` - View email address

### Best Practices
1. Always validate user permissions before executing Google API calls
2. Implement rate limiting to avoid API quota exhaustion
3. Log all API activities for audit purposes
4. Regularly review and rotate OAuth credentials
5. Monitor for unusual activity patterns

## Troubleshooting

### Common Issues

#### "No refresh token available"
- **Cause**: User needs to re-authenticate
- **Solution**: Redirect user to re-authorize the integration

#### "Token expired"
- **Cause**: Access token has expired and refresh failed
- **Solution**: Check refresh token validity, may need re-authorization

#### "Insufficient permissions"
- **Cause**: Missing required scopes
- **Solution**: Verify all required scopes are included in OAuth flow

#### "API quota exceeded"
- **Cause**: Too many API calls
- **Solution**: Implement caching and rate limiting

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
// In googleOAuthService.ts
const DEBUG = true; // Set to true for verbose logging
```

## Advanced Features

### Template Variables

Templates support variable replacement using `{{variable}}` syntax:

```javascript
const template = {
  title: "Proposal for {{company}}",
  content: [
    {
      type: "paragraph",
      text: "Dear {{contact}}, we're excited to present..."
    }
  ],
  variables: {
    company: "Acme Corp",
    contact: "John Doe"
  }
};
```

### Cross-Service Workflows

Create powerful automations by combining services:

1. **Document → Email**: Create a proposal doc, export as PDF, attach to email
2. **Calendar → Doc**: Create meeting notes document when calendar event ends
3. **Email → Drive**: Save email attachments to specific Drive folders
4. **Doc → Calendar**: Parse document for dates and create calendar events

### Batch Operations

For bulk operations, use batch processing:

```javascript
// Send multiple emails efficiently
const emails = contacts.map(contact => ({
  to: [contact.email],
  subject: `Update for ${contact.name}`,
  body: template.replace('{{name}}', contact.name)
}));

for (const email of emails) {
  await googleGmailService.sendEmail(userId, email);
  await delay(100); // Rate limiting
}
```

## Performance Optimization

### Caching Strategy
- Cache frequently accessed folders and labels
- Store document templates locally
- Implement TTL for cached integration status

### Rate Limiting
- Gmail: 250 quota units per user per second
- Calendar: 500 queries per 100 seconds
- Drive: 1000 queries per 100 seconds
- Docs: 60 requests per minute

### Best Practices
1. Batch API calls when possible
2. Use fields parameter to limit response data
3. Implement exponential backoff for retries
4. Cache OAuth clients per user session

## Monitoring & Analytics

Track integration usage with built-in logging:

```sql
-- View recent Google service activity
SELECT 
  service,
  action,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_time
FROM google_service_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY service, action, status
ORDER BY count DESC;
```

## Future Enhancements

- [ ] Google Sheets integration for data import/export
- [ ] Google Forms integration for survey automation
- [ ] Google Meet integration for video conferencing
- [ ] Advanced template builder UI
- [ ] Webhook support for real-time updates
- [ ] Batch operations API
- [ ] Advanced error recovery mechanisms
- [ ] Multi-account support per user

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API documentation at [Google Workspace Developer](https://developers.google.com/workspace)
3. Contact support with integration logs from `google_service_logs` table