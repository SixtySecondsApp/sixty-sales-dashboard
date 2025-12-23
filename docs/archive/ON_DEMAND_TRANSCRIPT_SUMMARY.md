# On-Demand Transcript and Summary Fetching

## 🎯 Overview

Separate Edge Functions that fetch transcript and enhanced summary data on-demand for individual meetings. This replaces the automatic fetching that was previously done during sync.

**Deployment Date**: 2025-10-26
**Status**: ✅ Deployed

## 🏗️ Architecture

### Edge Functions

#### 1. `fetch-transcript`
**Purpose**: Fetch full transcript text from Fathom and optionally create Google Doc

**Endpoint**: `POST /functions/v1/fetch-transcript`

**Request Body**:
```json
{
  "meetingId": "uuid-of-meeting"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "transcript": "Full transcript text...",
  "transcript_doc_url": "https://docs.google.com/document/d/...",
  "cached": false
}
```

**Response (Processing)**:
```json
{
  "success": false,
  "error": "Transcript not yet available - still processing",
  "processing": true
}
```

**Features**:
- ✅ Fetches from Fathom API: `GET /external/v1/recordings/{id}/transcript`
- ✅ Caches result in `meetings.transcript_text`
- ✅ Creates Google Doc automatically if user has Google integration
- ✅ Returns cached version if transcript already exists
- ✅ Returns 202 status if still processing (Fathom hasn't finished yet)

#### 2. `fetch-summary`
**Purpose**: Fetch enhanced summary with sentiment and talk time metrics

**Endpoint**: `POST /functions/v1/fetch-summary`

**Request Body**:
```json
{
  "meetingId": "uuid-of-meeting"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "summary": "Enhanced summary text...",
  "sentiment_score": "0.75",
  "coach_summary": "Coaching insights...",
  "talk_time_rep_pct": 45.5,
  "talk_time_customer_pct": 54.5,
  "talk_time_judgement": "Balanced conversation",
  "cached": false
}
```

**Response (Processing)**:
```json
{
  "success": false,
  "error": "Summary not yet available - still processing",
  "processing": true
}
```

**Features**:
- ✅ Fetches from Fathom API: `GET /external/v1/recordings/{id}/summary`
- ✅ Stores all enhanced fields in meetings table
- ✅ Returns cached version if enhanced summary already exists
- ✅ Returns 202 status if still processing

## 📊 Database Updates

### meetings table
Fields updated by these functions:

**Transcript Fields**:
- `transcript_text` - Full transcript plaintext
- `transcript_doc_url` - Google Doc URL (if Google integration exists)

**Summary Fields**:
- `summary` - Enhanced summary text
- `sentiment_score` - Sentiment analysis score (-1.0 to 1.0)
- `coach_summary` - Coaching insights
- `talk_time_rep_pct` - Sales rep talk time percentage
- `talk_time_customer_pct` - Customer talk time percentage
- `talk_time_judgement` - Talk time balance assessment

## 🎨 Frontend Integration

### React Hooks

#### `useFetchTranscript()`
```typescript
const { fetchTranscript, loading, error } = useFetchTranscript();

// Usage
const result = await fetchTranscript(meetingId);
if (result?.success) {
  console.log('Transcript:', result.transcript);
  console.log('Google Doc:', result.transcript_doc_url);
}
```

#### `useFetchSummary()`
```typescript
const { fetchSummary, loading, error } = useFetchSummary();

// Usage
const result = await fetchSummary(meetingId);
if (result?.success) {
  console.log('Summary:', result.summary);
  console.log('Sentiment:', result.sentiment_score);
}
```

### MeetingDetail Page Updates

**Fetch Transcript Button**:
- Shows "Fetch Transcript" button if `transcript_doc_url` is null
- Shows "Open transcript" link if transcript exists
- Displays loading spinner during fetch
- Shows error message if fetch fails or still processing

**Fetch Summary Button**:
- Shows "Fetch Summary" button if `summary` is null or missing enhanced data
- Updates meeting state with new summary data
- Displays loading spinner during fetch
- Shows error message if fetch fails or still processing

## 🔄 User Flow

### Transcript Fetching Flow

1. User views meeting detail page
2. If transcript not yet fetched, sees "Fetch Transcript" button
3. User clicks "Fetch Transcript"
4. Frontend calls `fetch-transcript` Edge Function
5. Edge Function:
   - Validates user authorization
   - Checks if transcript already cached
   - If not cached, fetches from Fathom API
   - Creates Google Doc if user has Google integration
   - Updates meetings table
   - Returns transcript data
6. Frontend updates UI:
   - Shows "Open transcript" link
   - Displays success or error message

### Summary Fetching Flow

1. User views meeting detail page
2. If enhanced summary not yet fetched, sees "Fetch Summary" button
3. User clicks "Fetch Summary"
4. Frontend calls `fetch-summary` Edge Function
5. Edge Function:
   - Validates user authorization
   - Checks if enhanced summary already cached
   - If not cached, fetches from Fathom API
   - Updates meetings table with all enhanced fields
   - Returns summary data
6. Frontend updates UI:
   - Shows enhanced summary text
   - Updates sentiment badge if available
   - Displays success or error message

## ⏱️ Processing Times

**Typical Processing Times** (after meeting ends):
- **Transcript**: 2-5 minutes for short meetings, 5-15 minutes for long meetings
- **Summary**: 5-10 minutes for most meetings
- **Action Items**: 5-10 minutes (already handled by bulk sync)

**User Experience**:
- If user fetches too early, they'll see a clear message: *"Transcript is still being processed by Fathom. Please try again in a few minutes."*
- Once processed, data is cached so subsequent views are instant

## 🔒 Security

### Authorization
- ✅ User JWT token required for all requests
- ✅ Validates user owns the meeting (`owner_user_id` check)
- ✅ Uses service role key for Supabase operations
- ✅ Validates Fathom integration exists for user

### Data Protection
- ✅ No sensitive data logged
- ✅ Error messages don't expose internal system details
- ✅ Google Doc creation only if user has Google integration
- ✅ Transcript and summary stored with proper RLS policies

## 🚨 Error Handling

### Common Errors

**"Meeting not found or access denied"**
- User doesn't own the meeting
- Meeting ID doesn't exist
- Solution: Verify meeting ownership

**"Fathom integration not found"**
- User hasn't connected Fathom account
- Integration was disconnected
- Solution: Reconnect Fathom integration

**"Transcript not yet available - still processing"**
- Fathom is still processing the recording
- Returns HTTP 202 (Accepted but not ready)
- Solution: Wait a few minutes and try again

**"Summary not yet available - still processing"**
- Fathom is still processing the summary
- Returns HTTP 202 (Accepted but not ready)
- Solution: Wait a few minutes and try again

**HTTP 404 from Fathom**
- Recording ID doesn't exist
- API endpoint format incorrect
- Solution: Verify recording ID and API endpoint

## 📝 API Documentation

### Fathom OAuth API Endpoints

**Transcript**:
```
GET https://api.fathom.ai/external/v1/recordings/{recording_id}/transcript
Authorization: Bearer {access_token}
```

**Summary**:
```
GET https://api.fathom.ai/external/v1/recordings/{recording_id}/summary
Authorization: Bearer {access_token}
```

**Response Formats**:

Transcript:
```json
{
  "transcript": "Full transcript text with speaker labels..."
}
```

Summary:
```json
{
  "summary": "Meeting summary text...",
  "sentiment": "0.75",
  "coach_summary": "Coaching insights...",
  "talk_time_rep_pct": 45.5,
  "talk_time_customer_pct": 54.5,
  "talk_time_judgement": "Balanced conversation"
}
```

## 🧪 Testing

### Manual Testing Steps

1. **Test Transcript Fetching**:
   ```bash
   # View a meeting without transcript
   # Click "Fetch Transcript" button
   # Should see loading spinner
   # Should update to show "Open transcript" link
   # Clicking link should open Google Doc
   ```

2. **Test Summary Fetching**:
   ```bash
   # View a meeting without enhanced summary
   # Click "Fetch Summary" button
   # Should see loading spinner
   # Should update to show enhanced summary
   # Sentiment badge should update if available
   ```

3. **Test Processing State**:
   ```bash
   # Try to fetch transcript/summary for very recent meeting
   # Should see error message about still processing
   # Wait 5-10 minutes and try again
   # Should succeed on second attempt
   ```

4. **Test Caching**:
   ```bash
   # Fetch transcript for a meeting
   # Refresh page
   # Should see "Open transcript" link immediately (cached)
   # No second API call to Fathom
   ```

### Edge Function Testing

**Test with curl**:
```bash
# Get auth token
export TOKEN="your-supabase-auth-token"
export MEETING_ID="uuid-of-meeting"

# Test transcript fetch
curl -X POST \
  https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fetch-transcript \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"meetingId\": \"$MEETING_ID\"}"

# Test summary fetch
curl -X POST \
  https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fetch-summary \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"meetingId\": \"$MEETING_ID\"}"
```

## 📊 Monitoring

### Success Metrics
- ✅ Transcript fetch success rate >95%
- ✅ Summary fetch success rate >95%
- ✅ Average fetch time <3 seconds (when data available)
- ✅ Cache hit rate for subsequent views 100%

### Logs to Monitor

**Success Logs**:
```
📄 Fetching transcript for recording 96272358...
✅ Transcript fetched: 15234 characters
📄 Creating Google Doc for transcript...
✅ Google Doc created: doc_id
✅ Transcript saved to meeting meeting_id
```

**Error Logs**:
```
❌ Transcript fetch failed: HTTP 404
ℹ️  Transcript not yet available (still processing)
❌ Error creating Google Doc: error_message
```

## 🔄 Migration from v30 → v31+

**Before (v30)**:
- Transcript and summary fetched automatically during sync
- All meetings had transcript data (if available)
- Google Docs created automatically

**After (v31+)**:
- Transcript and summary fetched on-demand per meeting
- User explicitly requests transcript/summary when needed
- Google Docs created only when user requests transcript
- Better control over API usage and costs

**Impact on Existing Meetings**:
- Meetings synced before v31 may have transcript/summary data
- Meetings synced after v31 will not have transcript/summary until requested
- Users can fetch transcript/summary for any meeting at any time

## 🎯 Future Enhancements

### Planned Features
1. **Batch Fetch**: Fetch transcript/summary for multiple meetings at once
2. **Auto-Fetch**: Option to auto-fetch for meetings matching criteria
3. **Refresh**: Re-fetch transcript/summary to get latest version
4. **Download**: Download transcript as TXT/PDF file
5. **Search**: Full-text search across all transcripts
6. **Highlights**: Extract and display key moments from transcript

### Performance Improvements
1. **Streaming**: Stream transcript as it's being fetched
2. **Progressive Loading**: Load summary first, then transcript
3. **Background Jobs**: Queue fetch operations for background processing
4. **Webhook Integration**: Use Fathom webhooks to know when processing completes

---

**Related Documentation**:
- [FATHOM_SYNC_V31_TRANSCRIPT_REMOVAL.md](./FATHOM_SYNC_V31_TRANSCRIPT_REMOVAL.md) - Removal of automatic fetching
- [ACTION_ITEMS_FINAL_SOLUTION.md](./ACTION_ITEMS_FINAL_SOLUTION.md) - Action items implementation
- [FATHOM_SYNC_COMPLETE.md](./FATHOM_SYNC_COMPLETE.md) - Complete sync history

**Files**:
- `/supabase/functions/fetch-transcript/index.ts` - Transcript Edge Function
- `/supabase/functions/fetch-summary/index.ts` - Summary Edge Function
- `/src/lib/hooks/useFetchTranscript.ts` - React hook for transcript
- `/src/lib/hooks/useFetchSummary.ts` - React hook for summary
- `/src/pages/MeetingDetail.tsx` - Frontend UI with fetch buttons
