# Email & Calendar Functionality Test Plan

## ✅ Completed Fixes

### Gmail Integration Fixes
1. **Fixed useGmailLabels hook** - Changed action from 'labels' to 'list-labels'
2. **Fixed useGmailSend hook** - Added action parameter to query string, added cc/bcc/attachments support
3. **Fixed useGmailMarkAsRead hook** - Changed action to 'mark-as-read' 
4. **Fixed useGmailTrash hook** - Changed action to 'delete'
5. **Added refreshAccessToken function** - Implemented token refresh in Gmail Edge Function
6. **Improved error handling** - Added try-catch blocks for email data processing
7. **Fixed action consistency** - Edge Function now handles both old and new action names

### Calendar Integration Fixes
1. **Added refreshAccessToken function** - Implemented token refresh in Calendar Edge Function
2. **Fixed token usage** - All calendar functions now use refreshed access token

## 📋 Testing Checklist

### Email Functionality Tests

#### 1. Gmail Connection & Authentication
- [ ] Connect Google account through OAuth flow
- [ ] Verify Gmail service is enabled in integration status
- [ ] Check token refresh works after expiration

#### 2. Email List & Display
- [ ] Load emails from Gmail inbox
- [ ] Display email list with proper formatting
- [ ] Show correct timestamps (no "Invalid Date")
- [ ] Display sender names and email addresses correctly
- [ ] Show email preview/snippet text
- [ ] Display attachment counts
- [ ] Show correct read/unread status
- [ ] Display starred emails correctly
- [ ] Show labels with proper names (not IDs)

#### 3. Email Filtering & Search
- [ ] Filter by folder (Inbox, Sent, Drafts, Starred, Trash)
- [ ] Filter by category (Primary, Social, Promotions, Updates, Forums)
- [ ] Filter by label
- [ ] Search emails by keyword
- [ ] Combine multiple filters

#### 4. Email Composition
- [ ] Open email composer
- [ ] Add recipients (To, CC, BCC)
- [ ] Enter subject
- [ ] Compose email body with rich text formatting
- [ ] Add signature
- [ ] Use email templates
- [ ] Schedule email for later
- [ ] Send email successfully
- [ ] Save draft

#### 5. Email Actions
- [ ] Mark email as read/unread
- [ ] Star/unstar emails
- [ ] Archive emails
- [ ] Move emails to trash
- [ ] Reply to emails
- [ ] Forward emails

#### 6. Email Filters & Rules
- [ ] Create email filter rules
- [ ] Apply actions based on conditions
- [ ] Test filter execution

### Calendar Functionality Tests

#### 1. Calendar Connection
- [ ] Verify Calendar service is enabled
- [ ] Load calendar list
- [ ] Display primary calendar

#### 2. Event Display
- [ ] Load events from Google Calendar
- [ ] Display events in calendar view
- [ ] Show event details correctly
- [ ] Display recurring events
- [ ] Show event attendees

#### 3. Event Creation
- [ ] Create new event with title and description
- [ ] Set start and end times
- [ ] Add attendees
- [ ] Set location
- [ ] Add video conferencing link
- [ ] Set reminders
- [ ] Create recurring events
- [ ] Save event successfully

#### 4. Event Management
- [ ] Update existing events
- [ ] Delete events
- [ ] Change event times (drag & drop)
- [ ] Invite/remove attendees
- [ ] Update recurring event series

#### 5. Calendar Availability
- [ ] Check availability across calendars
- [ ] Find free time slots
- [ ] Set working hours preferences
- [ ] Generate shareable booking links

## 🐛 Known Issues to Monitor

1. **Email Date Parsing** - Some Gmail dates may not parse correctly
2. **Label Mapping** - Gmail label IDs need to be mapped to names
3. **Email Body Decoding** - Base64 decoding may fail for some emails
4. **Attachment Handling** - Attachment upload/download not fully implemented
5. **Scheduled Send** - Backend implementation pending
6. **Draft Saving** - Draft functionality not connected to Gmail

## 🚀 Testing Process

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Open Email Interface**
   - Navigate to http://localhost:5173/email
   - Connect Google account if not already connected

3. **Test Each Feature**
   - Follow checklist above
   - Document any errors in console
   - Note UI/UX issues

4. **Open Calendar Interface**
   - Navigate to http://localhost:5173/calendar
   - Test calendar features per checklist

5. **Integration Testing**
   - Create calendar event from email
   - Send email with calendar invite
   - Test MCP workflow nodes

## 📊 Success Criteria

- ✅ All Gmail API calls succeed without errors
- ✅ Email data displays correctly without "Invalid Date" or missing fields
- ✅ All email actions (star, archive, mark as read) work
- ✅ Email composer sends emails successfully
- ✅ Calendar events create, update, and delete properly
- ✅ Token refresh works automatically when expired
- ✅ Error handling prevents app crashes
- ✅ UI remains responsive during API calls

## 🔧 Debug Commands

Check Edge Function logs:
```bash
supabase functions serve google-gmail --debug
supabase functions serve google-calendar --debug
```

Monitor network requests:
- Open DevTools Network tab
- Filter by "supabase" to see Edge Function calls
- Check request/response payloads

## 📝 Notes

- Email and Calendar functionality requires active Google OAuth connection
- Edge Functions must have GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars
- Token refresh happens automatically when access token expires (1 hour)
- All fixes have been implemented but need thorough testing