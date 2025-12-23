# Encharge Cron Job Setup Instructions

## Issue: Missing ENCHARGE_API_KEY

If you're seeing `"error":"Missing ENCHARGE_API_KEY"`, the secrets may not be properly accessible to the Edge Function. Follow these steps:

### Step 1: Verify Secrets Are Set

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ygdpgliavpxeugaajgrb
2. Navigate to **Settings** > **Edge Functions** > **Secrets**
3. Verify both secrets exist:
   - `ENCHARGE_API_KEY`
   - `ENCHARGE_WRITE_KEY`

### Step 2: Redeploy Functions (if secrets were just added)

If you just added the secrets, redeploy the functions so they can access them:

```bash
supabase functions deploy encharge-email --no-verify-jwt
supabase functions deploy scheduled-encharge-emails --no-verify-jwt
```

### Step 3: Set Up Cron Job

#### Option A: Via SQL Editor (Recommended)

1. **Get your Service Role Key**:
   - Go to Supabase Dashboard > **Settings** > **API**
   - Find **service_role** key (it's marked as "secret")
   - Click to reveal and copy the entire key

2. **Run the SQL**:
   - Go to **SQL Editor** in Supabase Dashboard
   - Open the file `MANUAL_ENCHARGE_CRON_SETUP.sql`
   - Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key
   - Run the SQL

#### Option B: Via Supabase Dashboard UI

1. Go to **Database** > **Cron Jobs** (if available in your Supabase plan)
2. Click **New Cron Job**
3. Set:
   - **Name**: `scheduled-encharge-emails`
   - **Schedule**: `0 * * * *` (every hour)
   - **SQL**:
   ```sql
   SELECT
     net.http_post(
       url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/scheduled-encharge-emails',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
       ),
       body := '{}'::jsonb
     ) AS request_id;
   ```

### Step 4: Verify Cron Job

Run this SQL to verify the cron job is scheduled:

```sql
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'scheduled-encharge-emails';
```

You should see 1 row with `active = true`.

### Step 5: Test the Function Manually

Test that the function works with secrets:

```bash
curl -X POST https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/encharge-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email_type": "welcome",
    "to_email": "test@example.com",
    "to_name": "Test User",
    "send_transactional": false
  }'
```

If you still get "Missing ENCHARGE_API_KEY", the secrets may not be accessible. Try:

1. **Check secret names are exact** (case-sensitive):
   - `ENCHARGE_API_KEY` (not `encharge_api_key`)
   - `ENCHARGE_WRITE_KEY` (not `encharge_write_key`)

2. **Redeploy the function** after setting secrets:
   ```bash
   supabase functions deploy encharge-email --no-verify-jwt
   ```

3. **Check function logs** in Supabase Dashboard:
   - Go to **Edge Functions** > **encharge-email** > **Logs**
   - Look for any errors about missing environment variables

## Troubleshooting

### Cron job not running?

1. Check if `pg_cron` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check cron job status:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'scheduled-encharge-emails';
   ```

3. Check cron job history:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'scheduled-encharge-emails')
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

### Function not accessible?

- Verify the function URL is correct: `https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/scheduled-encharge-emails`
- Check Edge Function logs for errors
- Ensure service role key is correct in the cron job SQL
