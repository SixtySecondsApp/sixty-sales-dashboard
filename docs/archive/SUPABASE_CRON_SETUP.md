# Supabase Edge Function Cron Setup (Recommended)

## Why This is Better

Instead of using PostgreSQL's pg_cron (which has configuration issues), use Supabase's built-in Edge Function scheduling. This is:

✅ **Simpler** - No database configuration needed
✅ **More Reliable** - Built into Supabase platform
✅ **Better Logging** - View logs in Edge Functions dashboard
✅ **No Permissions Issues** - Uses platform infrastructure

## Setup Steps

### Option 1: Via Supabase Dashboard (Easy)

1. **Go to Supabase Dashboard**
   - Navigate to Edge Functions section
   - Find `fathom-cron-sync` function

2. **Add Cron Schedule**
   - Look for "Cron" or "Schedule" tab
   - Set schedule: `0 * * * *` (every hour at minute 0)
   - Or use UI to select: "Every hour"

3. **Verify**
   - Check the "Invocations" tab after an hour
   - Should see automatic invocations

### Option 2: Via Supabase CLI (Advanced)

If you're using Supabase CLI locally, add to `config.toml`:

```toml
[functions.fathom-cron-sync]
verify_jwt = false

[[functions.fathom-cron-sync.schedule]]
schedule = "0 * * * *"  # Every hour
```

Then deploy:
```bash
supabase functions deploy fathom-cron-sync
```

## Disable Old pg_cron Job

Since we're using Supabase's native scheduling, disable the old pg_cron job:

```sql
-- Disable the old pg_cron job
SELECT cron.unschedule('fathom-hourly-sync');

-- Verify it's unscheduled
SELECT * FROM cron.job WHERE jobname = 'fathom-hourly-sync';
-- Should return no rows or show active = false

-- Keep the logs table for history
-- Don't delete cron_job_logs table
```

## Verify It's Working

After the next hour mark (e.g., 10:00, 11:00, 12:00):

1. **Check Edge Function Logs**:
   - Supabase Dashboard → Edge Functions → fathom-cron-sync → Logs
   - Should see automatic invocations every hour

2. **Check Sync Results**:
   ```sql
   -- New meetings syncing?
   SELECT COUNT(*) as new_meetings_today
   FROM meetings
   WHERE created_at > NOW() - INTERVAL '24 hours';
   
   -- Users being synced?
   SELECT COUNT(*) as active_integrations
   FROM fathom_integrations
   WHERE is_active = true;
   ```

## Troubleshooting

**Cron Not Appearing in Dashboard?**
- Check your Supabase pricing plan
- Cron scheduling may require Pro plan or higher
- Alternative: Use external cron service (see below)

**Edge Function Timing Out?**
- Check function timeout settings
- May need to increase timeout for bulk syncs
- Consider batching user syncs

## Alternative: External Cron Service

If Supabase cron isn't available on your plan, use an external service:

### Using Vercel Cron (Free)
```typescript
// api/cron/fathom-sync.ts
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Call Supabase Edge Function
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/fathom-cron-sync`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const result = await response.json();
  return res.json(result);
}
```

Then set cron in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/fathom-sync",
    "schedule": "0 * * * *"
  }]
}
```

### Using GitHub Actions (Free)
Create `.github/workflows/fathom-sync.yml`:
```yaml
name: Fathom Hourly Sync

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Fathom Sync
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/fathom-cron-sync" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

## Summary

**Recommended Approach**:
1. ✅ Use Supabase's built-in Edge Function cron (if available)
2. ✅ Disable old pg_cron job
3. ✅ Set up webhooks as primary sync method
4. ✅ Keep cron as backup for missed webhooks

**Result**: Clean, simple, reliable hourly sync without database configuration headaches!
