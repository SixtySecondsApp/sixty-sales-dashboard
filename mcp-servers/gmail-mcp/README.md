# Gmail MCP Server

A comprehensive Gmail integration server for the Model Context Protocol (MCP), providing full email management capabilities including reading, sending, organizing, and analyzing Gmail messages.

## 🚀 Features

### Core Email Operations
- **List & Search**: Advanced Gmail search with query operators
- **Read Messages**: Get individual emails and entire threads  
- **Send & Reply**: Send new emails, reply to messages, forward emails
- **Draft Management**: Create and manage draft messages
- **Schedule Sending**: Create scheduled drafts with reminders

### Email Organization  
- **Archive & Delete**: Move emails to archive or trash
- **Labels**: Create, apply, and manage Gmail labels
- **Star Management**: Star/unstar important messages
- **Read Status**: Mark messages as read or unread

### Advanced Features
- **Attachment Handling**: Extract and process email attachments
- **Thread Analysis**: AI-powered email thread summarization
- **Batch Operations**: Perform operations on multiple emails
- **Smart Filtering**: Advanced search and filtering capabilities

## 📋 Available Tools

### Email Management
- `gmail_list_emails` - List emails with filtering options
- `gmail_get_email` - Get specific email by ID
- `gmail_get_thread` - Get email thread with all messages
- `gmail_search` - Advanced search with Gmail operators

### Sending & Composition
- `gmail_send_email` - Send new email with attachments
- `gmail_reply_to_email` - Reply to existing messages
- `gmail_forward_email` - Forward emails to other recipients
- `gmail_create_draft` - Create draft messages
- `gmail_schedule_send` - Schedule emails (creates drafts)

### Organization
- `gmail_archive_email` - Archive messages
- `gmail_delete_email` - Delete or trash messages
- `gmail_mark_as_read` - Mark as read/unread
- `gmail_star_email` - Star/unstar messages

### Labels & Categories
- `gmail_apply_label` - Apply/remove labels
- `gmail_create_label` - Create new labels
- `gmail_get_labels` - List all available labels

### Advanced Features
- `gmail_extract_attachments` - Download attachments
- `gmail_summarize_thread` - AI thread summaries

## 🛠️ Setup

### Prerequisites
- Node.js 18+ 
- Gmail API credentials from Google Cloud Console

### Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"  
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application" or "Web application"
   - Add redirect URI: `http://localhost:3000/auth/callback`
5. Download the credentials JSON file

### Installation

```bash
# Navigate to the Gmail MCP directory
cd mcp-servers/gmail-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Google OAuth credentials
nano .env
```

### Environment Configuration

Edit `.env` file:

```bash
# Required: Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id_from_google_console
GOOGLE_CLIENT_SECRET=your_client_secret_from_google_console

# Optional: Custom redirect URI (must match Google Console)
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Optional: Persistent token storage
GMAIL_STORED_TOKENS=
```

### Build and Run

```bash
# Build the project
npm run build

# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## 🔐 Authentication

The server uses OAuth 2.0 for secure Gmail access. Authentication is required before using any Gmail tools.

### Authentication Flow

1. **Get Auth URL**: Use `gmail_authenticate` tool with `action: "get_auth_url"`
2. **Visit URL**: Open the provided URL in your browser
3. **Grant Permissions**: Sign in and authorize the application
4. **Get Code**: Copy the authorization code from the redirect URL
5. **Exchange Code**: Use `gmail_authenticate` with `action: "exchange_code"` and the code

### Example Authentication

```javascript
// Step 1: Get authentication URL
{
  "tool": "gmail_authenticate",
  "arguments": {
    "action": "get_auth_url"
  }
}

// Step 2: Exchange authorization code
{
  "tool": "gmail_authenticate", 
  "arguments": {
    "action": "exchange_code",
    "code": "authorization_code_from_browser"
  }
}
```

## 📖 Usage Examples

### Basic Email Operations

```javascript
// List recent emails
{
  "tool": "gmail_list_emails",
  "arguments": {
    "maxResults": 10,
    "query": "is:unread"
  }
}

// Get specific email
{
  "tool": "gmail_get_email",
  "arguments": {
    "messageId": "message_id_here",
    "format": "full"
  }
}

// Send new email
{
  "tool": "gmail_send_email",
  "arguments": {
    "to": ["recipient@example.com"],
    "subject": "Hello from MCP",
    "body": "This email was sent via MCP!",
    "isHtml": false
  }
}
```

### Advanced Search

```javascript
// Complex search query
{
  "tool": "gmail_search",
  "arguments": {
    "query": "from:john@example.com has:attachment older_than:7d",
    "maxResults": 25,
    "includeSpamTrash": false
  }
}
```

### Thread Management

```javascript
// Get email thread
{
  "tool": "gmail_get_thread",
  "arguments": {
    "threadId": "thread_id_here",
    "format": "full"
  }
}

// Summarize thread conversation  
{
  "tool": "gmail_summarize_thread",
  "arguments": {
    "threadId": "thread_id_here",
    "summaryType": "action_items",
    "maxMessages": 10
  }
}
```

### Batch Operations

```javascript
// Archive multiple emails
{
  "tool": "gmail_archive_email",
  "arguments": {
    "messageIds": ["msg1", "msg2", "msg3"]
  }
}

// Apply label to multiple emails
{
  "tool": "gmail_apply_label",
  "arguments": {
    "messageIds": ["msg1", "msg2"],
    "labelIds": ["Label_1", "IMPORTANT"],
    "action": "add"
  }
}
```

## 🔍 Gmail Search Operators

The server supports all Gmail search operators:

- `from:user@example.com` - From specific sender
- `to:user@example.com` - To specific recipient  
- `subject:keyword` - Subject contains keyword
- `has:attachment` - Messages with attachments
- `is:unread` - Unread messages
- `is:starred` - Starred messages
- `newer_than:7d` - Messages newer than 7 days
- `older_than:1y` - Messages older than 1 year
- `label:important` - Messages with specific label
- `filename:pdf` - Messages with PDF attachments

## 🏷️ Label Management

### System Labels
- `INBOX` - Inbox messages
- `SENT` - Sent messages  
- `DRAFT` - Draft messages
- `SPAM` - Spam messages
- `TRASH` - Deleted messages
- `STARRED` - Starred messages
- `IMPORTANT` - Important messages
- `UNREAD` - Unread messages

### Custom Labels
Create and manage custom labels for organization:

```javascript
// Create new label
{
  "tool": "gmail_create_label",
  "arguments": {
    "name": "Project Alpha",
    "color": {
      "backgroundColor": "#ff0000",
      "textColor": "#ffffff"
    }
  }
}
```

## 📎 Attachment Handling

Extract and process email attachments:

```javascript
// Extract all attachments from email
{
  "tool": "gmail_extract_attachments",
  "arguments": {
    "messageId": "message_id_here",
    "filenameFilter": "\\.(pdf|doc|docx)$"
  }
}
```

Attachments are returned as base64-encoded data that can be decoded and saved locally.

## 🤖 AI Thread Summarization

Generate intelligent summaries of email conversations:

```javascript
// Brief summary
{
  "tool": "gmail_summarize_thread",
  "arguments": {
    "threadId": "thread_id",
    "summaryType": "brief"
  }
}

// Action items extraction
{
  "tool": "gmail_summarize_thread", 
  "arguments": {
    "threadId": "thread_id",
    "summaryType": "action_items"
  }
}
```

## 🔒 Security & Privacy

- **OAuth 2.0**: Secure authentication without storing passwords
- **Minimal Permissions**: Only requests necessary Gmail scopes
- **Token Management**: Automatic token refresh and secure storage
- **No Data Storage**: Messages are not stored or cached by the server
- **Audit Trail**: All operations are logged for security monitoring

## 🛠️ Development

### Project Structure
```
src/
├── auth/
│   └── oauth.ts          # OAuth 2.0 authentication
├── tools/
│   └── index.ts          # Tool implementations  
├── gmail-client.ts       # Gmail API wrapper
└── index.ts             # MCP server entry point
```

### Scripts
```bash
npm run build     # Build TypeScript
npm run dev       # Development with hot reload
npm run start     # Production server
npm run test      # Run tests  
npm run lint      # ESLint checking
npm run format    # Prettier formatting
```

### Error Handling

The server provides comprehensive error handling:

- **Authentication Errors**: Clear OAuth flow guidance
- **Rate Limiting**: Automatic retry with exponential backoff  
- **Network Errors**: Graceful degradation and error reporting
- **Validation Errors**: Detailed input validation messages
- **Token Refresh**: Automatic token refresh on expiration

## 📚 API Reference

### Authentication Resources

- `gmail://auth/status` - Current authentication status
- `gmail://auth/url` - Generate OAuth URL

### Tool Categories

#### Core Operations
- List, get, search emails and threads
- Send, reply, forward, draft messages

#### Organization  
- Archive, delete, star messages
- Apply labels, create labels

#### Advanced
- Extract attachments, summarize threads
- Batch operations, custom filtering

## 🚀 Integration Examples

### CRM Integration
```javascript
// Find emails from specific customer
{
  "tool": "gmail_search",
  "arguments": {
    "query": "from:customer@company.com OR to:customer@company.com",
    "maxResults": 50
  }
}
```

### Support Workflows
```javascript  
// Auto-reply to support requests
{
  "tool": "gmail_reply_to_email",
  "arguments": {
    "messageId": "support_email_id",
    "body": "Thank you for contacting support. We'll respond within 24 hours.",
    "isHtml": false
  }
}
```

### Document Processing
```javascript
// Find and extract PDF attachments
{
  "tool": "gmail_search", 
  "arguments": {
    "query": "has:attachment filename:pdf newer_than:30d"
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the error messages for specific guidance
2. Verify Google Cloud Console configuration  
3. Ensure environment variables are set correctly
4. Check OAuth redirect URI configuration

## 🔄 Changelog

### v1.0.0
- Initial release with complete Gmail integration
- OAuth 2.0 authentication flow
- 18 Gmail tools covering all major operations
- Advanced search and filtering capabilities  
- AI-powered thread summarization
- Comprehensive error handling and security