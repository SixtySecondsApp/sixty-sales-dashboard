# ✅ Easiest Way to Test AI Analysis

## Use Your App's Built-in Sync Button!

Your app already has a Fathom sync UI with a test button that limits to 5 meetings.

### Steps:

1. **Start your dev server** (if not already running):
   ```bash
   cd /Users/andrewbryce/Documents/sixty-sales-dashboard
   npm run dev
   ```

2. **Open your app** in browser:
   ```
   http://localhost:5173
   ```

3. **Log in** to your account

4. **Navigate to Integrations page**:
   - Look for menu/navigation
   - Click "Integrations" or "Settings"
   - You should see the Fathom Integration card

5. **Click "Test Sync"** button
   - This will sync only the last 5 meetings
   - Perfect for testing without processing hundreds of meetings
   - Uses your logged-in session (no token needed!)

6. **Watch the sync progress**
   - The UI will show a loading state
   - Check browser console (`F12`) for detailed logs

## What the Test Sync Does

The `handleTestSync` function (line 60-74 in FathomSettings.tsx):
```typescript
await triggerSync({
  sync_type: 'manual',
  limit: 5  // Only processes 5 meetings for testing
});
```

This will:
- ✅ Fetch last 5 Fathom meetings
- ✅ Auto-fetch transcripts for each
- ✅ Run Claude AI analysis
- ✅ Extract action items
- ✅ Calculate talk time
- ✅ Analyze sentiment
- ✅ Store everything in database

## Monitor Progress

### In Browser Console (F12)
Look for:
```
Test sync result: { success: true, ... }
✅ Synced 5 meetings
```

### In Supabase Logs
Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter: `fathom-sync`

Look for:
```
✅ "🤖 Analyzing transcript with claude-haiku-4.5..."
✅ "✅ Transcript fetched: X characters"
✅ "✅ AI metrics stored: sentiment=X, rep=X%, customer=X%"
✅ "💾 Storing X AI-generated action items..."
```

## Verify Results

After the test sync completes (should take 2-5 minutes), run this SQL query:

```sql
SELECT
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_length,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  (SELECT COUNT(*)
   FROM meeting_action_items
   WHERE meeting_id = m.id AND ai_generated = true) as ai_items
FROM meetings m
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 5;
```

**Expected Results**:
- ✅ `transcript_length` > 0 (transcripts fetched)
- ✅ `sentiment_score` between -1.0 and 1.0
- ✅ `talk_time_rep_pct` + `talk_time_customer_pct` ≈ 100%
- ✅ `ai_items` > 0 (AI-generated action items)

## Troubleshooting

### Can't Find Integrations Page
- Check your app's routing
- Try: `http://localhost:5173/integrations`
- Or `http://localhost:5173/settings/integrations`
- Or `http://localhost:5173/admin`

### Test Sync Button Not Visible
- Make sure you're logged in
- Fathom integration must be connected first
- Check if there's a "Connect Fathom" button first

### "Sync Failed" Error
- Check browser console for details
- Check Supabase Edge Function logs
- Verify ANTHROPIC_API_KEY is set in Supabase secrets

### No Results After Sync
- Meetings might be too recent (<15 min old)
  - Transcripts need 5-10 min to process on Fathom's side
  - System will auto-retry up to 3 times
- Check if meetings have recordings in Fathom

## Why This Method is Best

✅ **No auth token hassle** - uses your logged-in session
✅ **Built-in UI** - button already exists in your app
✅ **Test-friendly** - only processes 5 meetings
✅ **Safe** - doesn't affect all your data
✅ **Real-world test** - uses actual user flow

---

**This is the recommended way to test!** 🎯
