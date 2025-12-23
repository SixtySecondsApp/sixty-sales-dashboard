# Deal Health Monitoring - Deployment Guide

## Overview

This document provides deployment instructions for the Deal Health Monitoring system, including the daily cron job Edge Function.

## Architecture

### Data Persistence
- **Health Scores**: Stored in `deal_health_scores` table with `last_calculated_at` timestamp
- **Historical Snapshots**: Stored in `deal_health_history` table for trend analysis
- **Smart Refresh**: Only recalculates scores older than 24 hours (configurable)
- **Cron Job**: Daily automated refresh of all active deal health scores

### Smart Refresh Strategy

The system implements a smart refresh strategy to optimize performance:

1. **On-Demand Refresh**: Manual "Recalculate All" button forces immediate recalculation
2. **Smart Refresh**: Only updates scores older than 24 hours (configurable threshold)
3. **Background Refresh**: Automatic smart refresh on dashboard page load
4. **Daily Cron**: Scheduled Edge Function runs daily at 2:00 AM UTC

### Edge Function Architecture

**File**: `supabase/functions/calculate-deal-health/index.ts`

**Features**:
- Service role authentication (bypasses RLS for background operations)
- Smart refresh logic (only updates stale scores)
- Comprehensive error handling and logging
- Results reporting (updated, skipped, failed counts)
- Historical snapshot creation

**Schedule**: Daily at 2:00 AM UTC (`0 2 * * *`)

## Deployment Steps

### 1. Prerequisites

Ensure you have:
- Supabase CLI installed (`npm install -g supabase`)
- Supabase project configured
- Environment variables set up

### 2. Deploy Edge Function

```bash
# Navigate to project root
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy the Edge Function
supabase functions deploy calculate-deal-health

# Verify deployment
supabase functions list
```

### 3. Schedule Cron Job

```bash
# Schedule the function to run daily at 2:00 AM UTC
supabase functions schedule calculate-deal-health --cron "0 2 * * *"

# Verify schedule
supabase functions schedule list
```

### 4. Test Edge Function

```bash
# Manual test invocation
supabase functions invoke calculate-deal-health

# Monitor logs
supabase functions logs calculate-deal-health --tail
```

## Testing Strategy

### 1. Smart Refresh Testing

```bash
# Start the development server
npm run dev

# Navigate to /crm/health
# Verify:
# - Page loads with existing health scores
# - "Smart Refresh" button appears (green)
# - "Recalculate All" button appears (blue)
# - Background smart refresh runs on mount
# - Only stale scores are updated (check network tab)
```

### 2. Timestamp Display Testing

Verify that each deal health card shows:
- ✅ Deal name (clickable to deal record)
- ✅ Company name (clickable to company page)
- ✅ Contact name (clickable to contact page)
- ✅ Deal owner name
- ✅ Deal value (formatted currency)
- ✅ Meeting count
- ✅ Days in current stage
- ✅ **Last updated timestamp** (e.g., "Updated 2 hours ago")

### 3. Cron Job Testing

```bash
# Check cron schedule
supabase functions schedule list

# View logs for automated runs
supabase functions logs calculate-deal-health --tail

# Verify database updates
# Query deal_health_scores table to check last_calculated_at timestamps
```

### 4. Performance Testing

Monitor these metrics:
- **Smart Refresh Speed**: Should only update stale scores (much faster than full recalc)
- **Cron Job Duration**: Should complete within 5-10 minutes for typical datasets
- **Database Performance**: Check for query optimization opportunities
- **Memory Usage**: Monitor Edge Function memory consumption

## Configuration

### Smart Refresh Threshold

Default: 24 hours (configurable)

To change the staleness threshold:

```typescript
// In DealHealthDashboard.tsx, change the smartRefresh parameter:
smartRefresh(24); // Change 24 to desired hours
```

### Cron Schedule

Default: Daily at 2:00 AM UTC (`0 2 * * *`)

To change the schedule:

```bash
# Unschedule current job
supabase functions schedule unschedule calculate-deal-health

# Schedule with new timing (e.g., every 6 hours)
supabase functions schedule calculate-deal-health --cron "0 */6 * * *"
```

### Cron Schedule Examples

```bash
# Every hour
supabase functions schedule calculate-deal-health --cron "0 * * * *"

# Every 6 hours
supabase functions schedule calculate-deal-health --cron "0 */6 * * *"

# Every day at midnight
supabase functions schedule calculate-deal-health --cron "0 0 * * *"

# Every Monday at 8 AM
supabase functions schedule calculate-deal-health --cron "0 8 * * 1"

# Every weekday at 6 AM
supabase functions schedule calculate-deal-health --cron "0 6 * * 1-5"
```

## Monitoring

### Health Check Queries

```sql
-- Check last calculation times
SELECT
  deal_id,
  overall_health_score,
  health_status,
  last_calculated_at,
  EXTRACT(EPOCH FROM (NOW() - last_calculated_at))/3600 AS hours_since_update
FROM deal_health_scores
ORDER BY last_calculated_at DESC;

-- Count stale scores (older than 24 hours)
SELECT COUNT(*)
FROM deal_health_scores
WHERE last_calculated_at < NOW() - INTERVAL '24 hours';

-- View cron job execution history
SELECT *
FROM deal_health_history
ORDER BY snapshot_at DESC
LIMIT 100;
```

### Edge Function Logs

```bash
# View recent logs
supabase functions logs calculate-deal-health --limit 100

# Tail logs in real-time
supabase functions logs calculate-deal-health --tail

# Filter for errors
supabase functions logs calculate-deal-health --tail | grep ERROR
```

## Troubleshooting

### Edge Function Not Running

1. **Check Deployment**:
   ```bash
   supabase functions list
   ```

2. **Verify Schedule**:
   ```bash
   supabase functions schedule list
   ```

3. **Check Logs**:
   ```bash
   supabase functions logs calculate-deal-health --tail
   ```

### Smart Refresh Not Working

1. **Check Network Tab**: Verify API calls to `refreshStaleHealthScores`
2. **Console Errors**: Check browser console for JavaScript errors
3. **Database Connection**: Ensure Supabase client is properly initialized

### Timestamp Not Displaying

1. **Verify Data**: Check that `last_calculated_at` exists in database
2. **Check Import**: Ensure `formatDistanceToNow` is imported from `date-fns`
3. **Console Log**: Add `console.log(healthScore.last_calculated_at)` to debug

### Performance Issues

1. **Index Health**: Ensure database indexes exist:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_deal_health_last_calculated
   ON deal_health_scores(last_calculated_at);

   CREATE INDEX IF NOT EXISTS idx_deal_health_user_id
   ON deal_health_scores(user_id);
   ```

2. **Query Optimization**: Check `EXPLAIN ANALYZE` on slow queries

3. **Batch Size**: Consider reducing batch size in Edge Function if processing many deals

## Rollback Procedures

### Unschedule Cron Job

```bash
# Remove scheduled job
supabase functions schedule unschedule calculate-deal-health
```

### Remove Edge Function

```bash
# Delete the function
supabase functions delete calculate-deal-health
```

### Revert UI Changes

```bash
# Revert to previous commit
git checkout HEAD~1 -- src/components/DealHealthDashboard.tsx
```

## Success Criteria

✅ Edge Function deployed successfully
✅ Cron job scheduled and running
✅ Smart refresh works on page load
✅ Manual refresh buttons functional
✅ Timestamp displays correctly
✅ Only stale scores are recalculated
✅ No console errors or warnings
✅ Performance metrics within acceptable range

## Next Steps

After successful deployment:

1. **Monitor Performance**: Watch cron job execution times and database load
2. **User Feedback**: Gather feedback on refresh speed and data freshness
3. **Optimization**: Fine-tune staleness threshold based on usage patterns
4. **Alerting**: Consider adding alerts for failed cron jobs or stale data
5. **Documentation**: Update user documentation with new features

## Support

For issues or questions:
- Check logs: `supabase functions logs calculate-deal-health --tail`
- Review database: Query `deal_health_scores` and `deal_health_history` tables
- Consult documentation: Supabase Edge Functions docs
- Contact support: Provide logs and error messages

---

**Last Updated**: 2025-01-XX
**Version**: 1.0.0
**Author**: Deal Health Monitoring System
