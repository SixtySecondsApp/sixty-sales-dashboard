# Quick Start: Testing Transcript AI Analysis

**Model**: Claude Haiku 4.5 (claude-haiku-4.5)

## 🚀 5-Minute Test Procedure

### Step 1: Set API Key (2 minutes)
1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
2. Click **"Secrets"** tab
3. Add secret:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `[your-anthropic-api-key]`
4. Click **"Add Secret"**
5. Redeploy: `npx supabase functions deploy fathom-sync`

### Step 2: Trigger Sync (1 minute)
```bash
# Get auth token from browser:
# Open DevTools → Console → Run:
localStorage.getItem('supabase.auth.token')

# Then run:
curl -X POST "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"sync_type":"manual","start_date":"2025-10-19T00:00:00Z","end_date":"2025-10-26T23:59:59Z","limit":5}'
```

### Step 3: Check Logs (1 minute)
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions?type=fathom-sync

**Look for:**
- ✅ `"✅ Transcript fetched: X characters"`
- ✅ `"🤖 Running Claude AI analysis..."`
- ✅ `"✅ AI metrics stored"`

### Step 4: Verify Database (1 minute)
Run in Supabase SQL Editor:

```sql
-- Quick check
SELECT
  title,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  (SELECT COUNT(*) FROM meeting_action_items WHERE meeting_id = m.id AND ai_generated = true) as ai_items
FROM meetings m
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 3;
```

**Expected Result:**
- sentiment_score between -1.0 and 1.0
- talk_time percentages add up to ~100
- ai_items > 0

## ✅ Success Indicators

You're done if you see:
1. ✅ No API key errors in logs
2. ✅ Transcripts fetched successfully
3. ✅ AI metrics populated in database
4. ✅ AI-generated action items created

## ❌ Common Issues

### "ANTHROPIC_API_KEY not configured"
→ Go back to Step 1, ensure secret is saved

### "Transcript not yet available"
→ Normal for meetings < 15 min old, will retry automatically

### "Claude API error: 401"
→ Invalid API key, check it at https://console.anthropic.com/

### No results in database
→ Wait 5 minutes after sync, check if meetings have recordings in Fathom

## 📚 Full Documentation

- Complete testing guide: `TESTING_GUIDE.md` (Test 0)
- SQL verification queries: `VERIFY_TRANSCRIPT_AI_ANALYSIS.sql`
- Detailed implementation: `AI_ANALYSIS_IMPLEMENTATION.md`

## 💰 Cost Estimate

- ~$0.01 per meeting analyzed
- 5 meetings test = ~$0.05
- 100 meetings/month = ~$1/month
