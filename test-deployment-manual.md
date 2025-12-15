# Manual Deployment Testing Guide

Since the feature is deployed, test it manually through the UI and verify database state.

## 🧪 Testing Steps

### 1. Test Database Migrations ✅

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Check if sentiment analysis columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'communication_events' 
  AND column_name IN (
    'sentiment_score', 
    'ai_analyzed', 
    'ai_model', 
    'key_topics', 
    'action_items', 
    'urgency', 
    'response_required',
    'email_subject',
    'email_body_preview',
    'email_thread_id',
    'external_id',
    'sync_source'
  )
ORDER BY column_name;

-- Expected: 12 rows

-- Check if last_login_at exists in profiles
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'last_login_at';

-- Expected: 1 row

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'communication_events' 
  AND indexname LIKE 'idx_communication_events%'
ORDER BY indexname;

-- Expected: Multiple indexes including sentiment-related ones
```

### 2. Test UI Components ✅

1. **Navigate to Settings**:
   - Go to `/settings` in your browser
   - Look for "Email Sync" tab
   - ✅ Should see EmailSyncPanel component

2. **Test Email Sync Panel**:
   - Click "Email Sync" tab
   - Select a sync period (e.g., "Last 30 Days")
   - Click "Sync Emails" button
   - ✅ Should show progress indicator
   - ✅ Should display sync status after completion

### 3. Test Sentiment Analysis (Requires API Key) ✅

**Option A: Through Email Sync**
1. Ensure you have CRM contacts with email addresses
2. Ensure Google account is connected (`/integrations`)
3. Run email sync from Settings → Email Sync
4. Check `communication_events` table for entries with `sentiment_score`

**Option B: Direct API Test**
Open browser console and run:

```javascript
// Test sentiment analysis
const { analyzeEmailWithClaude } = await import('/src/lib/services/emailAIAnalysis.js');

const result = await analyzeEmailWithClaude(
  'Great meeting today!',
  'Thank you for the excellent meeting. I\'m excited about moving forward.'
);

console.log('Sentiment Analysis Result:', result);
// Expected: { sentiment_score: 0.5-0.8, key_topics: [...], urgency: 'medium', ... }
```

### 4. Test Health Score Integration ✅

1. **Navigate to Health Monitoring**:
   - Go to `/health-monitoring` or deal health dashboard
   - Open a deal that has email communications

2. **Verify Sentiment Display**:
   - ✅ Should see sentiment score in health metrics
   - ✅ Should see sentiment trend (improving/stable/declining)
   - ✅ Should see average sentiment from emails

3. **Check Database**:
```sql
-- Check if health scores include sentiment
SELECT 
  deal_id,
  sentiment_score,
  sentiment_trend,
  avg_sentiment_last_3_meetings
FROM deal_health_scores
WHERE sentiment_score IS NOT NULL
LIMIT 5;
```

### 5. Test Edge Functions ✅

**Check Function Deployment**:
1. Go to Supabase Dashboard → Edge Functions
2. Verify these functions exist:
   - `scheduled-email-sync`
   - `scheduled-health-refresh`

**Test Function Manually**:
```bash
# Get your project URL and service role key from Supabase Dashboard
PROJECT_URL="https://your-project.supabase.co"
SERVICE_KEY="your-service-role-key"
CRON_SECRET="your-cron-secret"

# Test health refresh
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  "$PROJECT_URL/functions/v1/scheduled-health-refresh"

# Test email sync
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  "$PROJECT_URL/functions/v1/scheduled-email-sync"
```

### 6. Verify Email Sync Flow ✅

1. **Prerequisites**:
   - ✅ Google account connected
   - ✅ Gmail service enabled
   - ✅ At least one CRM contact with email

2. **Run Sync**:
   - Go to Settings → Email Sync
   - Select "Last 30 Days"
   - Click "Sync Emails"

3. **Verify Results**:
```sql
-- Check synced emails
SELECT 
  id,
  email_subject,
  sentiment_score,
  ai_analyzed,
  urgency,
  response_required,
  sync_source,
  created_at
FROM communication_events
WHERE sync_source = 'gmail'
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Recent email entries with sentiment scores
```

### 7. Test Health Score Calculation ✅

1. **Create Test Data** (if needed):
   - Create a deal
   - Add a contact with email
   - Sync emails for that contact

2. **Calculate Health Score**:
   - Navigate to deal health dashboard
   - Or trigger manually via API/UI

3. **Verify Sentiment Integration**:
```sql
-- Check deal health includes email sentiment
SELECT 
  dhs.deal_id,
  dhs.sentiment_score,
  dhs.sentiment_trend,
  COUNT(ce.id) as email_count,
  AVG(ce.sentiment_score) as avg_email_sentiment
FROM deal_health_scores dhs
LEFT JOIN communication_events ce ON ce.deal_id = dhs.deal_id
WHERE ce.sync_source = 'gmail' AND ce.sentiment_score IS NOT NULL
GROUP BY dhs.deal_id, dhs.sentiment_score, dhs.sentiment_trend
LIMIT 5;
```

## ✅ Success Criteria

- [ ] Database migrations applied (all columns exist)
- [ ] EmailSyncPanel visible in Settings
- [ ] Email sync completes successfully
- [ ] Sentiment scores calculated for emails
- [ ] Health scores include sentiment data
- [ ] Edge functions deployed (check Supabase Dashboard)
- [ ] No console errors in browser
- [ ] UI components render correctly

## 🐛 Troubleshooting

### "Sentiment columns not found"
- Run migrations: `supabase db push`
- Or manually run migration SQL files

### "API Key not configured"
- Set `VITE_ANTHROPIC_API_KEY` in environment variables
- For production: Set in Vercel environment variables
- For edge functions: Set in Supabase secrets

### "Email sync fails"
- Check Google account is connected
- Verify Gmail service is enabled
- Check browser console for errors
- Verify CRM contacts have email addresses

### "Health scores don't show sentiment"
- Ensure emails have been synced
- Verify emails have `sentiment_score` populated
- Check deal has associated contacts
- Trigger health score recalculation

## 📊 Expected Results

After successful testing:

1. **Database**: All migration columns exist
2. **UI**: Email Sync panel functional
3. **Sentiment**: Scores calculated (-1 to 1 range)
4. **Health Scores**: Include sentiment metrics
5. **Edge Functions**: Deployed and accessible
6. **Email Sync**: Successfully syncs and analyzes emails

---

**Test Date**: ___________  
**Tester**: ___________  
**Results**: ✅ Pass / ❌ Fail  
**Notes**: ___________




























