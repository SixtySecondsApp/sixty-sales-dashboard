# Phase 7 Testing Guide - Meeting Intelligence RAG System

**Project:** Sixty v1 (Meetings)  
**Project ID:** `7a62ba1e-74c5-4c57-801b-b15e82ab1ecc`  
**Branch:** `meetings-feature-v1`  
**Phase:** Phase 7 - Google File Search RAG System  
**Feature URL:** `http://localhost:5175/meetings/intelligence`

---

## 🎯 Overview

Phase 7 implements a comprehensive RAG (Retrieval-Augmented Generation) system using Google File Search API to enable semantic search across meeting transcripts. This guide covers testing:

1. **Phase 7.1** - Google File Search Integration (database tables, store creation, document indexing)
2. **Phase 7.2** - RAG Query Interface (`/meetings/intelligence` page)
3. **Phase 7.3** - Automatic Transcript Indexing (queue system, background processing)

---

## 🚀 Quick Setup

1. **Ensure you're on the correct branch:**
   ```bash
   git checkout meetings-feature-v1
   ```

2. **Verify migrations are applied:**
   ```sql
   -- Check if tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'user_file_search_stores',
     'meeting_file_search_index',
     'meeting_index_queue',
     'meeting_intelligence_queries'
   );
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:** http://localhost:5175/meetings/intelligence

5. **Verify Google API Key is configured:**
   - Check AI Settings page: `/settings/ai`
   - Ensure Gemini API key is set (required for File Search)

---

## 📋 Phase 7.1 Testing - Google File Search Integration

### Test 1: Verify Database Tables

**SQL Query:**
```sql
-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_file_search_stores'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'user_file_search_stores';
```

**Expected Results:**
- ✅ Table `user_file_search_stores` exists with columns: id, user_id, store_name, display_name, status, total_files, last_sync_at, error_message, created_at, updated_at
- ✅ Table `meeting_file_search_index` exists
- ✅ Table `meeting_index_queue` exists
- ✅ Table `meeting_intelligence_queries` exists
- ✅ RLS policies exist for SELECT, INSERT, UPDATE, DELETE
- ✅ Indexes exist on `user_id` and foreign keys

### Test 2: Verify File Search Store Creation

**Steps:**
1. Navigate to `/meetings/intelligence`
2. Check the index status section at the top
3. Look for store status indicator

**In Browser Console:**
```javascript
// Check if store exists for current user
const { data: store, error } = await supabase
  .from('user_file_search_stores')
  .select('*')
  .eq('user_id', 'your-user-id')
  .single();
console.log('File Search Store:', store, error);
```

**Expected Results:**
- ✅ Store is automatically created on first access (if not exists)
- ✅ Store has `status: 'active'` or `'syncing'`
- ✅ Store has `store_name` (Google File Search store ID)
- ✅ Store shows `total_files: 0` initially

### Test 3: Test Store Status Updates

**Steps:**
1. Navigate to `/meetings/intelligence`
2. Observe the status indicator showing indexed/total counts
3. Check if status updates in real-time

**Expected Results:**
- ✅ Status indicator shows current index status
- ✅ Real-time updates via Supabase subscriptions
- ✅ Status changes from 'idle' → 'syncing' → 'active' during indexing

---

## 📋 Phase 7.2 Testing - RAG Query Interface

### Test 1: Access Meeting Intelligence Page

**URL:** `http://localhost:5175/meetings/intelligence`

**Navigation Paths:**
1. Direct URL: `/meetings/intelligence`
2. From navigation menu (if available)
3. From meeting detail page (if link exists)

**Expected Results:**
- ✅ Page loads without errors
- ✅ Shows search input field
- ✅ Shows example queries
- ✅ Shows index status indicator
- ✅ Shows recent queries sidebar (if any)
- ✅ Shows team filter dropdown (if team members exist)

### Test 2: Basic Search Functionality

**Steps:**
1. Enter a query: "What objections came up in recent demos?"
2. Click search button or press Enter
3. Wait for results

**Expected Results:**
- ✅ Search executes successfully
- ✅ Loading state shows while searching
- ✅ Results display with:
  - Answer text (AI-generated summary)
  - Sources list (meetings referenced)
  - Query metadata (meetings searched, response time)
- ✅ Sources are clickable and navigate to meeting detail
- ✅ Query is saved to recent queries

### Test 3: Natural Language Query Parsing

**Test Queries:**
1. "What objections came up in recent demos?"
2. "Summarize discussions about pricing"
3. "Which meetings had negative sentiment?"
4. "What did prospects say about competitors?"
5. "Find meetings where next steps were discussed"

**Expected Results:**
- ✅ All queries parse correctly
- ✅ Semantic query is extracted
- ✅ Structured filters are applied (if mentioned)
- ✅ Results are relevant to query intent
- ✅ Citations reference correct meetings

### Test 4: Filter Functionality

**Test Cases:**

1. **Sentiment Filter:**
   - Select "Negative" sentiment filter
   - Enter query: "What went wrong?"
   - **Expected:** Only negative sentiment meetings in results

2. **Date Range Filter:**
   - Select "Last 7 days" date preset
   - Enter query: "What was discussed?"
   - **Expected:** Only meetings from last 7 days in results

3. **Action Items Filter:**
   - Select "Has Action Items: Yes"
   - Enter query: "What tasks were mentioned?"
   - **Expected:** Only meetings with action items in results

4. **Combined Filters:**
   - Select "Last 30 days" + "Positive sentiment"
   - Enter query: "What went well?"
   - **Expected:** Results match both filters

**Expected Results:**
- ✅ Filters apply correctly
- ✅ Filter state persists during session
- ✅ Multiple filters can be combined
- ✅ Results respect all active filters

### Test 5: Team Filter Functionality

**Prerequisites:**
- User must be part of a team with multiple members
- Other team members must have meetings

**Steps:**
1. Check team filter dropdown (should show team members)
2. Select "All Team" option
3. Enter query: "What did we discuss?"
4. Check results show meetings from all team members
5. Select specific team member
6. Enter same query
7. Check results show only that member's meetings

**Expected Results:**
- ✅ Team filter dropdown shows team members
- ✅ "All Team" option searches across all team meetings
- ✅ Individual member filter searches only their meetings
- ✅ Results show owner name for each source
- ✅ Query metadata shows correct meeting count

### Test 6: Query History

**Steps:**
1. Perform multiple searches with different queries
2. Check recent queries sidebar
3. Click on a recent query
4. Verify it populates search field and executes

**Expected Results:**
- ✅ Recent queries appear in sidebar
- ✅ Queries are persisted (survive page refresh)
- ✅ Clicking recent query executes search
- ✅ Recent queries are limited (e.g., last 10)

### Test 7: Source Navigation

**Steps:**
1. Perform a search
2. Click on a source meeting card
3. Verify navigation to meeting detail page

**Expected Results:**
- ✅ Source cards are clickable
- ✅ Clicking navigates to `/meetings/{meeting-id}`
- ✅ Meeting detail page loads correctly
- ✅ Meeting detail shows relevant information

### Test 8: Citation Accuracy

**Steps:**
1. Perform a search with specific query
2. Review the answer text
3. Check if cited meetings are actually relevant
4. Click on sources to verify content matches

**Expected Results:**
- ✅ Citations reference correct meetings
- ✅ Relevance snippets show relevant content
- ✅ Answer accurately summarizes cited meetings
- ✅ No false positives in citations

### Test 9: Empty State Handling

**Test Cases:**

1. **No Meetings Indexed:**
   - User with no indexed meetings
   - **Expected:** Shows message about indexing, "Sync" button available

2. **No Search Results:**
   - Query that matches no meetings
   - **Expected:** Shows "No results found" message with suggestions

3. **No Meetings at All:**
   - User with no meetings
   - **Expected:** Shows empty state with onboarding guidance

**Expected Results:**
- ✅ Appropriate empty states for each scenario
- ✅ Clear messaging about what to do next
- ✅ Action buttons available (e.g., "Sync" to index)

### Test 10: Error Handling

**Test Cases:**

1. **API Key Missing:**
   - Remove Gemini API key from settings
   - **Expected:** Error message about missing API key

2. **Network Error:**
   - Disconnect internet
   - **Expected:** Error message about connection failure

3. **Invalid Query:**
   - Submit empty query
   - **Expected:** Validation prevents submission

4. **Rate Limiting:**
   - Perform many rapid searches
   - **Expected:** Rate limit handling (if implemented)

**Expected Results:**
- ✅ Errors display clearly to user
- ✅ Error messages are actionable
- ✅ App doesn't crash on errors
- ✅ User can retry after errors

---

## 📋 Phase 7.3 Testing - Automatic Transcript Indexing

### Test 1: Manual Full Index Trigger

**Steps:**
1. Navigate to `/meetings/intelligence`
2. Click "Sync" button in index status section
3. Observe status changes
4. Wait for indexing to complete

**Expected Results:**
- ✅ "Sync" button triggers indexing
- ✅ Status changes to "syncing"
- ✅ Progress updates in real-time
- ✅ Indexed count increases
- ✅ Status returns to "active" when complete
- ✅ All user meetings are indexed

### Test 2: Automatic Indexing on Fathom Sync

**Prerequisites:**
- User has Fathom integration connected
- New meetings available to sync

**Steps:**
1. Sync new meetings from Fathom (via Integrations page)
2. Wait for sync to complete
3. Check `/meetings/intelligence` index status
4. Verify new meetings are automatically indexed

**Expected Results:**
- ✅ New meetings are automatically queued for indexing
- ✅ Indexing happens in background
- ✅ Status updates reflect new indexed meetings
- ✅ No manual intervention required

### Test 3: Queue System Functionality

**SQL Query:**
```sql
-- Check queue status
SELECT 
  miq.id,
  miq.meeting_id,
  miq.priority,
  miq.attempts,
  miq.max_attempts,
  miq.last_attempt_at,
  miq.error_message,
  m.title as meeting_title
FROM meeting_index_queue miq
JOIN meetings m ON m.id = miq.meeting_id
WHERE miq.user_id = 'your-user-id'
ORDER BY miq.priority DESC, miq.created_at ASC;
```

**Expected Results:**
- ✅ Meetings are added to queue when sync happens
- ✅ Queue processes items in priority order
- ✅ Failed items retry with exponential backoff
- ✅ Queue status updates correctly

### Test 4: Individual Meeting Indexing

**Steps:**
1. Navigate to a meeting detail page
2. Check if "Index Meeting" or "Query this Meeting" button exists
3. Click button (if available)
4. Verify meeting is indexed

**Expected Results:**
- ✅ Can manually index individual meetings
- ✅ Index status updates after indexing
- ✅ Meeting becomes searchable immediately

### Test 5: Index Status Accuracy

**Steps:**
1. Check index status on `/meetings/intelligence`
2. Compare with actual meeting count:
   ```sql
   SELECT COUNT(*) as total_meetings
   FROM meetings
   WHERE owner_user_id = 'your-user-id';
   ```
3. Check indexed count:
   ```sql
   SELECT COUNT(*) as indexed_meetings
   FROM meeting_file_search_index
   WHERE user_id = 'your-user-id'
   AND status = 'indexed';
   ```

**Expected Results:**
- ✅ Indexed count matches actual indexed meetings
- ✅ Total count matches user's meeting count
- ✅ Pending count shows meetings waiting to index
- ✅ Failed count shows meetings that failed indexing

### Test 6: Re-indexing Functionality

**Steps:**
1. Index a meeting
2. Modify the meeting transcript (if possible)
3. Trigger re-index
4. Verify updated content is indexed

**Expected Results:**
- ✅ Can re-index meetings
- ✅ Updated content replaces old content
- ✅ Content hash detects changes
- ✅ Re-indexing updates `indexed_at` timestamp

### Test 7: Error Handling and Retries

**Test Cases:**

1. **Temporary API Error:**
   - Simulate API failure during indexing
   - **Expected:** Item retries automatically

2. **Permanent Failure:**
   - Meeting with invalid data
   - **Expected:** After max attempts, marked as failed

3. **Queue Processing:**
   - Multiple meetings in queue
   - **Expected:** Processes sequentially, handles errors gracefully

**Expected Results:**
- ✅ Failed items retry automatically
- ✅ Max retry limit respected
- ✅ Error messages logged for debugging
- ✅ Queue continues processing despite failures

---

## 🔍 Verification Queries

### Check File Search Store

```sql
-- Get user's File Search store
SELECT 
  id,
  user_id,
  store_name,
  display_name,
  status,
  total_files,
  last_sync_at,
  error_message,
  created_at,
  updated_at
FROM user_file_search_stores
WHERE user_id = 'your-user-id';
```

### Check Indexed Meetings

```sql
-- List all indexed meetings
SELECT 
  mfsi.id,
  mfsi.meeting_id,
  m.title as meeting_title,
  mfsi.status,
  mfsi.indexed_at,
  mfsi.error_message,
  mfsi.content_hash
FROM meeting_file_search_index mfsi
JOIN meetings m ON m.id = mfsi.meeting_id
WHERE mfsi.user_id = 'your-user-id'
ORDER BY mfsi.indexed_at DESC;
```

### Check Queue Status

```sql
-- View queue items
SELECT 
  miq.id,
  miq.meeting_id,
  m.title as meeting_title,
  miq.priority,
  miq.attempts,
  miq.max_attempts,
  miq.last_attempt_at,
  miq.error_message,
  miq.created_at
FROM meeting_index_queue miq
JOIN meetings m ON m.id = miq.meeting_id
WHERE miq.user_id = 'your-user-id'
ORDER BY miq.priority DESC, miq.created_at ASC;
```

### Check Query History

```sql
-- View recent queries
SELECT 
  id,
  query_text,
  parsed_semantic_query,
  parsed_filters,
  results_count,
  response_time_ms,
  created_at
FROM meeting_intelligence_queries
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Index Statistics

```sql
-- Get indexing statistics
SELECT 
  COUNT(*) FILTER (WHERE status = 'indexed') as indexed_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) as total_meetings
FROM meeting_file_search_index
WHERE user_id = 'your-user-id';
```

---

## 🐛 Troubleshooting

### "Meeting Intelligence page doesn't load"
- Check browser console for errors
- Verify route exists: `/meetings/intelligence`
- Check if `MeetingIntelligence.tsx` file exists
- Verify user is logged in
- Check if migrations are applied

### "No search results"
- Verify meetings are indexed (check index status)
- Check if File Search store exists
- Verify Gemini API key is configured
- Check edge function logs for errors
- Verify meetings have transcripts

### "Indexing not working"
- Check queue for pending items
- Verify edge functions are deployed
- Check Google API key permissions
- Review edge function logs
- Verify meeting transcripts exist

### "Store not created"
- Check if user has Gemini API key configured
- Verify edge function `meeting-intelligence-index` is deployed
- Check edge function logs
- Try manual store creation via edge function

### "Search is slow"
- Check response time in query metadata
- Verify File Search store has files indexed
- Check network tab for API calls
- Review edge function performance logs

### "Team filter not working"
- Verify user is part of a team
- Check if team members have meetings
- Verify RLS policies allow team access
- Check query filters are applied correctly

---

## ✅ Testing Checklist

### Phase 7.1 - Google File Search Integration ✅
- [ ] Database tables exist with correct schema
- [ ] RLS policies work correctly
- [ ] Indexes exist for performance
- [ ] File Search store is created automatically
- [ ] Store status updates correctly
- [ ] Store persists across sessions

### Phase 7.2 - RAG Query Interface ✅
- [ ] Page loads correctly
- [ ] Search executes successfully
- [ ] Natural language queries parse correctly
- [ ] Filters apply correctly (sentiment, date, action items)
- [ ] Team filter works (all team, individual members)
- [ ] Query history saves and loads
- [ ] Sources navigate to meeting detail
- [ ] Citations are accurate
- [ ] Empty states display correctly
- [ ] Error handling works

### Phase 7.3 - Automatic Indexing ✅
- [ ] Manual full index trigger works
- [ ] Automatic indexing on Fathom sync works
- [ ] Queue system processes items correctly
- [ ] Individual meeting indexing works
- [ ] Index status is accurate
- [ ] Re-indexing works
- [ ] Error handling and retries work
- [ ] Failed items are handled gracefully

---

## 📝 Test Data Examples

### Sample Search Queries

1. **Discovery Questions:**
   - "What pain points did prospects mention?"
   - "What are the common objections?"
   - "What did prospects say about competitors?"

2. **Sentiment Analysis:**
   - "Which meetings had negative sentiment?"
   - "What went well in recent calls?"
   - "Show me meetings where sentiment declined"

3. **Action Items:**
   - "What tasks were mentioned in discovery calls?"
   - "Find meetings where next steps were discussed"
   - "What follow-ups were promised?"

4. **Topic Summarization:**
   - "Summarize discussions about pricing"
   - "What did we discuss about integrations?"
   - "What questions came up about features?"

### Sample Filter Combinations

1. **Recent Negative Sentiment:**
   - Query: "What went wrong?"
   - Filters: Last 30 days + Negative sentiment

2. **High-Value Discovery:**
   - Query: "What pain points were mentioned?"
   - Filters: Last 7 days + Has action items

3. **Team Performance:**
   - Query: "What did we discuss?"
   - Filters: All team + This month

---

## 🎯 Performance Benchmarks

### Expected Response Times
- **Search Query:** < 3 seconds (with File Search)
- **Fallback Search:** < 2 seconds (without File Search)
- **Indexing (per meeting):** < 5 seconds
- **Full Index (100 meetings):** < 10 minutes

### Expected Accuracy
- **Citation Accuracy:** > 90% (citations reference relevant meetings)
- **Query Understanding:** > 85% (semantic query extraction)
- **Filter Application:** 100% (filters always applied correctly)

---

**Last Updated:** 2025-11-26  
**Branch:** `meetings-feature-v1`  
**Phase:** 7 - Google File Search RAG System  
**Feature URL:** `http://localhost:5175/meetings/intelligence`

