# Quick Start: Reprocess Meetings with Claude AI

## ⚡ 5-Minute Setup

### 1. Deploy Edge Function (One-Time Setup)

```bash
# Set environment variables in Supabase Dashboard first:
# ANTHROPIC_API_KEY = your_key_here
# CLAUDE_MODEL = claude-haiku-4-5-20251001

# Deploy function
supabase functions deploy reprocess-meetings-ai
```

### 2. Run Reprocessing

```bash
# Get your Supabase anon key
cat .env | grep VITE_SUPABASE_ANON_KEY

# Reprocess all meetings (safe - skips existing)
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/reprocess-meetings-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"force": false, "limit": 100}'
```

### 3. View Results

1. Open any meeting detail page
2. See "Action Items" section in right sidebar
3. Click "Add to Tasks" to manually create tasks

## ✅ What You Get

- 🤖 **AI-Extracted Action Items**: Claude Haiku 4.5 analyzes transcripts
- 📋 **Manual Task Control**: You choose which items become tasks
- 🏷️ **Rich Metadata**: Priority, category, confidence scores
- ⏱️ **Timestamp Links**: Jump to relevant parts of video (if available)
- 📊 **Talk Time Analysis**: See rep vs customer speaking time
- 😊 **Sentiment Analysis**: Understand meeting tone

## 🎯 Key Features

### In the UI

**Action Items Section:**
- Lists all action items from the meeting
- Shows priority, category, and AI confidence
- Checkbox to mark items complete
- "Add to Tasks" button (only when NOT synced)
- "Remove from Tasks" button (only when synced)
- Timestamp playback links

**Tasks Section:**
- Lists tasks created from action items
- Separate from action items for clarity
- Traditional task management interface

### Manual Workflow

```
Meeting → View Action Items → Review → Add to Tasks → Complete
```

No automatic syncing! You're in full control.

## 📊 Verification Queries

### Check Processing Status

```sql
SELECT
    m.title,
    COUNT(mai.id) as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.transcript_text IS NOT NULL
GROUP BY m.id, m.title
ORDER BY m.meeting_start DESC
LIMIT 10;
```

### Verify No Auto-Sync

```sql
SELECT
    COUNT(*) FILTER (WHERE synced_to_task = false) as not_synced,
    COUNT(*) FILTER (WHERE synced_to_task = true) as synced
FROM meeting_action_items
WHERE ai_generated = true;
```

Expected: `not_synced` should be high, `synced` should be 0 (until you manually add to tasks).

## 🚨 Common Issues

### "No action items created"
- Check if meetings have transcripts
- Some meetings legitimately have no action items
- Check Edge Functions logs for errors

### "Action Items not showing in UI"
- Clear browser cache (Cmd+Shift+R)
- Verify data in database with SQL query above
- Check console for React errors

### "Edge function failed"
- Verify ANTHROPIC_API_KEY is set
- Check you deployed the function
- View logs in Supabase Dashboard

## 📈 Performance

- **Speed**: ~2-5 seconds per meeting
- **Cost**: ~$0.001 per meeting (Claude Haiku 4.5)
- **Accuracy**: High confidence items (>0.8) need no review

## 🔄 Re-running

Safe to run multiple times:
- `force: false` = skips meetings with existing action items
- `force: true` = deletes and recreates (use with caution!)

## 📚 Full Documentation

See `REPROCESS_MEETINGS_GUIDE.md` for:
- Detailed deployment instructions
- All API options and parameters
- Troubleshooting guide
- Security and performance details

---

That's it! You're ready to use AI-powered action item extraction with full manual control. 🎉
