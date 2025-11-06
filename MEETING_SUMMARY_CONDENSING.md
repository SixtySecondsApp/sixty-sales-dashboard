# AI-Powered Meeting Summary Condensing

## Overview

This feature uses Claude Haiku 4.5 to automatically condense long meeting summaries into two concise one-liners for improved readability in the activity table and meeting cards.

**Implementation Date**: November 6, 2025
**Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
**Cost**: ~$0.001 per meeting summary condensed

## Problem Statement

Meeting summaries from Fathom were appearing as very long text in the Details column of the activity table, making it hard to scan and read. Users needed:
- Quick understanding of what was discussed
- Clear visibility into next steps
- Scannable format for activity tables

## Solution

### Two One-Liner Format
Each meeting summary is condensed into:
1. **Meeting About** (max 15 words): What was discussed
2. **Next Steps** (max 15 words): What happens next

### Example
**Original Summary**:
```
## Meeting Overview
We had an in-depth discussion about the Q4 pricing strategy for our enterprise tier.
The customer expressed concerns about implementation timeline and asked about
security certifications. We reviewed their current infrastructure and agreed that
a technical demo would be beneficial. Action items include sending a detailed
proposal with pricing breakdown by Friday and scheduling a technical demo with
their engineering team for next week.
```

**Condensed**:
- 💬 **Discussion**: Discussed enterprise pricing tier, implementation timeline, and security requirements for Q1 rollout
- ▶️ **Next Steps**: Send detailed proposal with pricing breakdown by Friday, schedule technical demo next week

## Implementation

### 1. Edge Function

**File**: `/supabase/functions/condense-meeting-summary/index.ts`

**Features**:
- Uses Claude Haiku 4.5 for cost-effective condensing
- Intelligent prompt engineering for consistent output
- Fallback to simple truncation if AI fails
- Non-blocking error handling

**API Contract**:
```typescript
// Request
{
  summary: string;
  meetingTitle?: string;
}

// Response
{
  success: boolean;
  meeting_about?: string;  // Max 15 words
  next_steps?: string;     // Max 15 words
  error?: string;
}
```

### 2. Database Schema

**File**: `/supabase/migrations/20251106000001_add_condensed_summary_fields.sql`

**New Columns**:
- `meetings.summary_oneliner` (TEXT): AI-condensed discussion summary
- `meetings.next_steps_oneliner` (TEXT): AI-condensed next steps

**Indexes**:
- `idx_meetings_summary_oneliner`: Fast searching by discussion topics
- `idx_meetings_next_steps_oneliner`: Fast searching by next steps

### 3. Sync Integration

**Modified Files**:
- `/supabase/functions/fathom-sync/index.ts`

**Integration Points**:
1. **Initial Sync**: When meeting is first synced with summary from bulk API
2. **Transcript Fetch**: When new summary is fetched from Fathom
3. **Existing Meetings**: Automatically condenses summaries that don't have oneliners yet

**Error Handling**:
- Non-fatal errors - meeting sync continues even if condensing fails
- Comprehensive logging for debugging
- Automatic fallback to original summary

### 4. UI Updates

**Modified Files**:
- `/src/lib/hooks/useActivities.ts`: Added meetings join to fetch condensed summaries
- `/src/components/SalesTable.tsx`: Display condensed summaries in Details column
- `/src/components/MeetingCard.tsx`: Show condensed summaries in meeting cards

**Display Logic**:
- Meeting activities show condensed summaries if available
- Non-meeting activities continue using regular details field
- Fallback to full summary if condensed versions not available
- Visual distinction with icons (💬 for discussion, ▶️ for next steps)

## Deployment Guide

### Prerequisites
1. **Environment Variables**:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (already configured for existing AI features)
   - `SUPABASE_URL`: Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key for internal Edge Function calls

2. **Verify Anthropic Credits**:
   - Claude Haiku 4.5 is very cheap (~$0.001/meeting)
   - Check your Anthropic account has sufficient credits

### Step 1: Deploy Database Migration

```bash
# Navigate to project directory
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Apply migration
supabase db push
```

**Verify**:
```sql
-- Check columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('summary_oneliner', 'next_steps_oneliner');

-- Check indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename = 'meetings'
  AND indexname LIKE '%oneliner%';
```

### Step 2: Deploy Edge Function

```bash
# Deploy the condense-meeting-summary function
supabase functions deploy condense-meeting-summary
```

**Verify**:
```bash
# Test the function with a sample summary
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/condense-meeting-summary" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "We discussed the Q4 pricing strategy for our enterprise tier. The customer expressed concerns about implementation timeline and security. We agreed to send a proposal by Friday and schedule a technical demo next week.",
    "meetingTitle": "Enterprise Pricing Discussion"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "meeting_about": "Discussed enterprise pricing tier, implementation timeline, and security requirements",
  "next_steps": "Send proposal by Friday, schedule technical demo next week"
}
```

### Step 3: Deploy Updated Fathom Sync

```bash
# Deploy the updated fathom-sync function
supabase functions deploy fathom-sync
```

### Step 4: Deploy Frontend Changes

```bash
# Build frontend
npm run build

# Verify no TypeScript errors
npm run type-check

# Deploy to your hosting platform (Vercel, Netlify, etc.)
```

### Step 5: Test End-to-End

#### Test 1: New Meeting Sync
```bash
# Trigger a Fathom sync to import a new meeting
# Use your CRM's Fathom integration settings or API

# Check the meeting was condensed
```

```sql
SELECT
  title,
  summary_oneliner,
  next_steps_oneliner,
  created_at
FROM meetings
WHERE summary_oneliner IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

#### Test 2: Activity Table Display
1. Navigate to Activity Log in your CRM
2. Filter for meeting activities
3. Verify Details column shows:
   - 💬 icon with discussion summary
   - ▶️ icon with next steps (in emerald color)

#### Test 3: Meeting Card Display
1. Navigate to Meetings page
2. View a meeting card
3. Verify Summary section shows:
   - "💬 Discussion" with condensed summary
   - "▶️ Next Steps" with condensed actions

## Backfilling Existing Meetings

For meetings that were synced before this feature was deployed:

### Option 1: Automatic Backfill (Recommended)
The sync integration automatically condenses summaries for existing meetings when they're updated or re-synced.

**Trigger**:
- Manual sync from CRM settings
- Webhook updates from Fathom
- Incremental sync (runs hourly)

### Option 2: Manual Backfill Script

Create `/supabase/functions/backfill-meeting-summaries/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Get meetings with summaries but no condensed versions
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, summary')
    .not('summary', 'is', null)
    .is('summary_oneliner', null)
    .limit(100)

  let processed = 0
  let failed = 0

  for (const meeting of meetings || []) {
    try {
      // Call condense function
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/condense-meeting-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: meeting.summary,
          meetingTitle: meeting.title,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await supabase
          .from('meetings')
          .update({
            summary_oneliner: data.meeting_about,
            next_steps_oneliner: data.next_steps,
          })
          .eq('id', meeting.id)

        processed++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`Failed to process meeting ${meeting.id}:`, error)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ processed, failed, total: meetings?.length || 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

**Deploy and Run**:
```bash
supabase functions deploy backfill-meeting-summaries

# Run backfill (may need to run multiple times for large datasets)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/backfill-meeting-summaries" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring & Costs

### Cost Estimation
- **Claude Haiku 4.5 Pricing**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- **Average Meeting Summary**: ~500 input tokens, ~50 output tokens
- **Cost per Meeting**: ~$0.0013 (0.13 cents)
- **Monthly Cost (100 meetings)**: ~$0.13

### Monitoring

#### Success Rate
```sql
SELECT
  COUNT(*) as total_meetings,
  COUNT(summary_oneliner) as condensed_meetings,
  ROUND(COUNT(summary_oneliner)::numeric / COUNT(*)::numeric * 100, 2) as success_rate_pct
FROM meetings
WHERE summary IS NOT NULL;
```

#### Recent Condensing Activity
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as meetings_condensed
FROM meetings
WHERE summary_oneliner IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Check for Failures (Long Summaries)
```sql
-- Find meetings with summaries but no condensed versions
SELECT
  id,
  title,
  LENGTH(summary) as summary_length,
  created_at
FROM meetings
WHERE summary IS NOT NULL
  AND summary_oneliner IS NULL
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;
```

## Error Handling & Fallbacks

### Error Scenarios

1. **Claude API Timeout**:
   - Falls back to simple truncation
   - Meeting sync continues normally
   - Logged as warning, not error

2. **Invalid API Key**:
   - Function returns error
   - Meeting sync continues without condensed summaries
   - Original summary remains available

3. **Rate Limiting**:
   - Automatic retry with exponential backoff (if implemented)
   - Or skip condensing and retry on next sync

4. **Empty Summary**:
   - Function returns error, no condensed summaries created
   - UI shows "No details" or existing details field

### Logging
All operations are logged with clear prefixes:
- `📝 Condensing summary...`
- `✅ Summary condensed successfully`
- `❌ Condense summary service error`
- `⚠️ AI condensing failed, using fallback truncation`

## Future Enhancements

### Potential Improvements
1. **Multi-Language Support**: Detect and preserve language in condensing
2. **Sentiment Indicators**: Add emoji or color coding based on sentiment
3. **Keyword Extraction**: Highlight key topics or products discussed
4. **Action Item Detection**: Auto-link to tasks table when next steps mention specific actions
5. **Progressive Enhancement**: Re-condense summaries when full transcript becomes available
6. **User Preferences**: Allow users to customize condensing style or length

### Performance Optimizations
1. **Batch Processing**: Condense multiple summaries in a single API call
2. **Caching**: Cache condensed summaries by content hash to avoid re-condensing duplicates
3. **Async Processing**: Move condensing to background job for faster meeting sync
4. **Selective Condensing**: Only condense summaries longer than X characters

## Troubleshooting

### Issue: Condensed Summaries Not Appearing

**Check 1: Database Columns Exist**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN ('summary_oneliner', 'next_steps_oneliner');
```

**Check 2: Edge Function Deployed**
```bash
supabase functions list
```

**Check 3: Edge Function Logs**
```bash
supabase functions logs condense-meeting-summary --tail
```

**Check 4: Meeting Has Summary**
```sql
SELECT id, title, summary, summary_oneliner
FROM meetings
WHERE id = 'YOUR_MEETING_ID';
```

### Issue: "ANTHROPIC_API_KEY not configured"

**Solution**: Set environment variable in Supabase Dashboard
1. Go to Project Settings → Edge Functions → Environment Variables
2. Add `ANTHROPIC_API_KEY` with your Anthropic API key
3. Redeploy functions: `supabase functions deploy condense-meeting-summary`

### Issue: UI Not Showing Condensed Summaries

**Check 1: Frontend Deployed**
Ensure latest frontend code is deployed with updated Activity interface

**Check 2: Clear Cache**
Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

**Check 3: Check Browser Console**
Look for TypeScript errors or missing data

## Support

For issues or questions:
1. Check logs: `supabase functions logs condense-meeting-summary`
2. Check database: Run monitoring SQL queries above
3. Verify API key: Test direct call to Edge Function
4. Review error messages in browser console

## Related Documentation

- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference/messages)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Fathom Integration Guide](./FATHOM_INTEGRATION_GUIDE.md)
- [Activity Processing Documentation](./ACTIVITY_PROCESSING.md)
