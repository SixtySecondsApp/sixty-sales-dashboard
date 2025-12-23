# Trigger Sync from Supabase Dashboard (No Token Needed!)

## Easiest Method: Use Supabase Dashboard

Instead of using curl with an auth token, you can trigger the function directly from Supabase:

### Steps:

1. **Go to Edge Functions**:
   https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions

2. **Find `fathom-sync` function** in the list

3. **Click the three dots menu** (⋮) on the right side of the function

4. **Select "Invoke"** or "Test"

5. **Enter this JSON body**:
   ```json
   {
     "sync_type": "manual",
     "start_date": "2025-10-19T00:00:00Z",
     "end_date": "2025-10-26T23:59:59Z",
     "limit": 5
   }
   ```

6. **Click "Run" or "Invoke"**

7. **Check the Response** and **Logs** tabs

## What This Does

- Syncs meetings from the last 7 days (Oct 19-26)
- Limits to 5 meetings for testing
- Automatically fetches transcripts
- Runs Claude AI analysis
- Stores results in database

## Monitoring

After triggering, go to **Logs**:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter by: `fathom-sync`

**Look for**:
```
✅ "🤖 Analyzing transcript with claude-haiku-4.5..."
✅ "✅ Transcript fetched: X characters"
✅ "✅ AI metrics stored: sentiment=X, rep=X%, customer=X%"
✅ "💾 Storing X AI-generated action items..."
```

## Verify Results

After sync completes, run this SQL query in Supabase SQL Editor:

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

**Expected**: Meetings with populated sentiment scores, talk time percentages, and AI action items!

## Troubleshooting

### "Function requires authentication"
- The dashboard invoke should automatically use your logged-in credentials
- Make sure you're logged into Supabase dashboard

### "No meetings found"
- Check if you have Fathom meetings in the date range
- Verify Fathom integration is connected

### "ANTHROPIC_API_KEY not configured"
- You still need to set the API key secret first!
- Go to Functions → Secrets → Add `ANTHROPIC_API_KEY`

## Alternative: Test in Browser App

If the dashboard method doesn't work, you can also trigger from your app:

1. Open your app in browser
2. Log in
3. Navigate to any page that triggers a sync
4. Or create a test button that calls the sync function

---

**Tip**: The dashboard method is the easiest - no need to deal with auth tokens!
