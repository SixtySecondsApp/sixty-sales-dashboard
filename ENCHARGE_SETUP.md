# Encharge Email Integration Setup Guide

## Environment Variables

### Supabase Edge Function Secrets

Configure these secrets in your Supabase project dashboard under Settings > Edge Functions > Secrets:

```bash
ENCHARGE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjE1NDI0MCwibmFtZSI6ImJhc2UifQ.-AF-vsstqDuRZfY4OUbYyjcfCPqbW6bDfbjRdtqV--Y
ENCHARGE_WRITE_KEY=UY95xBh931HqCJ5xhx6YsBbM4
```

### Setting Secrets via Supabase CLI

```bash
# Set API key
supabase secrets set ENCHARGE_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjE1NDI0MCwibmFtZSI6ImJhc2UifQ.-AF-vsstqDuRZfY4OUbYyjcfCPqbW6bDfbjRdtqV--Y"

# Set Write Key
supabase secrets set ENCHARGE_WRITE_KEY="UY95xBh931HqCJ5xhx6YsBbM4"
```

### Setting Secrets via Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Edge Functions**
3. Click **Manage secrets**
4. Add each secret:
   - Key: `ENCHARGE_API_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Key: `ENCHARGE_WRITE_KEY`
   - Value: `UY95xBh931HqCJ5xhx6YsBbM4`

---

## Cron Job Setup

The scheduled email function runs every hour. Set up the cron job in Supabase:

### Via SQL Editor

```sql
-- Schedule the function to run every hour
SELECT cron.schedule(
  'scheduled-encharge-emails',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduled-encharge-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### Via Dashboard

1. Go to **Database** > **Cron Jobs**
2. Click **New Cron Job**
3. Set schedule: `0 * * * *` (every hour)
4. Set SQL:
```sql
SELECT
  net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduled-encharge-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
```

---

## Database Migration

Run the email journeys migration:

```bash
# Via Supabase CLI
supabase db push

# Or manually in SQL Editor
# Run: supabase/migrations/20251211000002_email_journeys.sql
```

---

## Testing

### Test Edge Function Locally

```bash
# Start Supabase locally
supabase start

# Test encharge-email function
curl -X POST http://localhost:54321/functions/v1/encharge-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email_type": "welcome",
    "to_email": "test@example.com",
    "to_name": "Test User",
    "send_transactional": true,
    "template_id": "Welcome to Sixty"
  }'
```

### Test Scheduled Emails

```bash
# Invoke scheduled function manually
curl -X POST http://localhost:54321/functions/v1/scheduled-encharge-emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## Verification Checklist

- [ ] Environment variables set in Supabase secrets
- [ ] Database migration applied successfully
- [ ] Edge functions deployed
- [ ] Cron job scheduled (if using scheduled emails)
- [ ] Test email sent successfully
- [ ] Email templates created in Encharge dashboard (see below)
