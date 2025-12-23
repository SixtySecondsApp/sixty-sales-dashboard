# Reprocess Meetings with Claude Haiku 4.5 - Complete Guide

## 🎯 Overview

This guide explains how to reprocess all meeting transcripts using Claude Haiku 4.5 AI to extract action items. Action items will be displayed in the meetings page with "Add to Tasks" buttons, allowing manual selection of which items to track as tasks.

## ✨ What This Does

1. **Analyzes Transcripts**: Uses Claude Haiku 4.5 to analyze all meeting transcripts
2. **Extracts Action Items**: Identifies tasks, commitments, and follow-ups from conversations
3. **Stores Action Items**: Saves action items WITHOUT automatically creating tasks
4. **Manual Task Selection**: Provides "Add to Tasks" button for each action item
5. **Full Control**: You decide which action items become tasks

## 📋 Prerequisites

1. **Supabase Project**: Your Supabase project must be set up
2. **Anthropic API Key**: You need an API key for Claude AI
3. **Fathom Integration**: Meetings must have transcripts from Fathom
4. **Environment Variables**: Set up in Supabase Edge Functions

## 🚀 Deployment Steps

### Step 1: Set Environment Variables in Supabase

1. Go to Supabase Dashboard → Settings → Edge Functions → Configuration
2. Add these environment variables:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   CLAUDE_MODEL=claude-haiku-4-5-20251001
   ```

### Step 2: Deploy the Edge Function

```bash
# From project root directory
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy the reprocess function
supabase functions deploy reprocess-meetings-ai

# Verify deployment
supabase functions list
```

You should see `reprocess-meetings-ai` in the list of deployed functions.

### Step 3: Verify Frontend Changes

The MeetingDetail component has been updated with:
- ✅ Action Items section displaying all meeting action items
- ✅ "Add to Tasks" button for each action item (when not synced)
- ✅ "Remove from Tasks" button for synced items
- ✅ Visual indicators: AI badge, priority, category, sync status
- ✅ Checkbox to mark action items complete
- ✅ Timestamp playback links (if available)

No frontend deployment needed - changes are already in the codebase.

## 📖 How to Use

### Option 1: Reprocess All Meetings (Recommended)

```bash
# Get your Supabase anon key from .env
cat .env | grep VITE_SUPABASE_ANON_KEY

# Run the reprocess function
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "force": false,
    "limit": 100
  }'
```

**Parameters:**
- `force`: false = skip meetings with existing action items (safe)
- `limit`: 100 = process up to 100 meetings (remove for unlimited)

### Option 2: Force Reprocess (Deletes Existing Action Items)

⚠️ **WARNING**: This deletes all existing action items and recreates them!

```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "force": true
  }'
```

### Option 3: Process Specific Meetings

```bash
# First, get meeting IDs from SQL (see reprocess-all-meetings.sql)
# Then run with specific IDs:

curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "meeting_ids": ["meeting-id-1", "meeting-id-2"],
    "force": false
  }'
```

### Option 4: Process for Specific User

```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "user-uuid-here",
    "force": false
  }'
```

## 📊 Verification

### 1. Check Processing Results

Run this SQL query in Supabase SQL Editor:

```sql
-- See which meetings were processed
SELECT
    m.title,
    m.meeting_start,
    COUNT(mai.id) as action_items,
    COUNT(*) FILTER (WHERE mai.ai_generated = true) as ai_generated,
    COUNT(*) FILTER (WHERE mai.synced_to_task = false) as not_synced
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.transcript_text IS NOT NULL
GROUP BY m.id, m.title, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 20;
```

### 2. Verify No Auto-Sync

Action items should NOT be automatically synced to tasks:

```sql
SELECT
    COUNT(*) as total_action_items,
    COUNT(*) FILTER (WHERE synced_to_task = true) as synced,
    COUNT(*) FILTER (WHERE synced_to_task = false) as not_synced,
    COUNT(*) FILTER (WHERE task_id IS NULL) as no_task_link
FROM meeting_action_items
WHERE ai_generated = true;
```

Expected result: `synced = 0`, `no_task_link = total_action_items`

### 3. Check AI Metrics

```sql
SELECT
    COUNT(*) as meetings_with_transcripts,
    COUNT(*) FILTER (WHERE sentiment_score IS NOT NULL) as has_sentiment,
    COUNT(*) FILTER (WHERE talk_time_rep_pct IS NOT NULL) as has_talk_time,
    ROUND(AVG(sentiment_score)::numeric, 2) as avg_sentiment,
    ROUND(AVG(talk_time_rep_pct)::numeric, 1) as avg_rep_talk_pct
FROM meetings
WHERE transcript_text IS NOT NULL;
```

## 🎨 User Workflow

### 1. View Meeting Action Items

1. Navigate to a meeting detail page
2. Scroll to the "Action Items" section in the right sidebar
3. See all action items extracted by Claude AI

### 2. Review Action Items

Each action item shows:
- ✅ Checkbox to mark complete
- 🏷️ Priority badge (high/medium/low)
- 🤖 AI badge (if AI-generated)
- 📂 Category (if available)
- ✓ "In Tasks" badge (if already added to tasks)
- ⏱️ Timestamp link (if available)

### 3. Add to Tasks

1. Click "Add to Tasks" button on any action item
2. Action item is converted to a task in your task list
3. Button changes to "Remove from Tasks"
4. "✓ In Tasks" badge appears

### 4. Remove from Tasks

1. Click "Remove from Tasks" button
2. Task is deleted from task list
3. Action item remains in meeting
4. Button changes back to "Add to Tasks"

### 5. Mark Complete

- Check the checkbox to mark action item complete
- Works for both synced and unsynced action items
- Completion status is preserved

## 🔍 Troubleshooting

### Edge Function Not Deployed

```bash
# Check deployed functions
supabase functions list

# If missing, deploy:
supabase functions deploy reprocess-meetings-ai
```

### API Key Not Working

1. Check environment variable is set:
   - Supabase Dashboard → Settings → Edge Functions → Configuration
   - Verify `ANTHROPIC_API_KEY` exists

2. Test with a single meeting first:
   - Use Option 3 with just one `meeting_id`
   - Check Edge Functions logs for errors

### No Action Items Created

Possible causes:
1. **No transcript**: Meeting must have `transcript_text` populated
2. **Claude found no action items**: Not all meetings have action items
3. **API error**: Check Edge Functions logs

Verification:
```sql
-- Check if meetings have transcripts
SELECT
    COUNT(*) as total_meetings,
    COUNT(*) FILTER (WHERE transcript_text IS NOT NULL) as has_transcript,
    COUNT(*) FILTER (WHERE transcript_text IS NULL) as no_transcript
FROM meetings;
```

### Function Logs

View logs in Supabase Dashboard:
1. Go to Edge Functions → reprocess-meetings-ai
2. Click "Logs" tab
3. Look for errors or processing details

### Action Items Not Appearing in UI

1. **Clear browser cache**: Force refresh (Cmd+Shift+R or Ctrl+Shift+R)
2. **Check database**: Run verification SQL queries above
3. **Rebuild frontend**: `npm run build` if needed

## 📈 Performance

- **Processing Speed**: ~2-5 seconds per meeting
- **21 meetings**: ~1-2 minutes total
- **Token Usage**: ~500-1000 tokens per meeting
- **Cost**: ~$0.001-0.002 per meeting (Claude Haiku 4.5)

## 🔒 Security

- ✅ Uses service role key (bypasses RLS)
- ✅ Only admins can deploy edge functions
- ✅ API key stored securely in Supabase
- ✅ No sensitive data logged
- ✅ Action items linked to correct users

## 🎯 Next Steps

After reprocessing:

1. **Review Action Items**: Visit meeting pages and review AI-generated action items
2. **Curate Tasks**: Use "Add to Tasks" for items you want to track
3. **Mark Complete**: Check off completed action items
4. **Adjust as Needed**: Remove items from tasks if priorities change

## 📚 Additional Resources

- **SQL Scripts**: `reprocess-all-meetings.sql` - All verification queries
- **Edge Function Code**: `supabase/functions/reprocess-meetings-ai/index.ts`
- **AI Analysis Logic**: `supabase/functions/fathom-sync/aiAnalysis.ts`
- **Frontend Component**: `src/pages/MeetingDetail.tsx`

## ❓ FAQ

**Q: Will this delete my existing tasks?**
A: No! Unless you use `force: true`, existing action items are preserved. Tasks are only affected if you manually click "Remove from Tasks".

**Q: Can I undo if something goes wrong?**
A: Yes! Action items are stored separately from tasks. If needed, you can restore from the `meeting_action_items_backup_20250106` table (if cleanup script was run previously).

**Q: How often should I reprocess?**
A: Only when needed:
- After initial setup
- If AI model improves
- If you want to re-analyze old meetings

**Q: What if Claude makes mistakes?**
A: That's why it's manual! Review action items and only add ones that make sense to your task list.

**Q: Can I edit action items?**
A: Currently, you can mark them complete or delete them. Editing coming soon!

---

🎉 **You're all set!** Start reprocessing your meetings and enjoy AI-powered action item extraction with full manual control.
