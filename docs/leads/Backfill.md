## SavvyCal Lead Backfill Guide

This guide explains how to import historical SavvyCal bookings into the CRM so they appear in the new Leads inbox.

### 1. Prerequisites

1. **Environment variables**
   - `SUPABASE_URL` – project URL (already used by the frontend)
   - `SUPABASE_SERVICE_ROLE_KEY` – service role key (keep secret)
   - `SAVVYCAL_API_TOKEN` – SavvyCal personal access token (minimum `events:read`)
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Confirm edge functions are deployed**
   - `savvycal-leads-webhook`
   - `process-lead-prep` (optional but recommended post-import)

### 2. Fetch Historic Events & Ingest

Use the helper script to pull events from SavvyCal’s REST API and relay them through the webhook pipeline:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="service-role-key"
export SAVVYCAL_API_TOKEN="savvycal-token"

npx tsx scripts/backfillSavvyCalLeads.ts \
  --since 2025-07-01T00:00:00Z \
  --until 2025-11-12T23:59:59Z \
  --scope sixtyseconds \
  --batch 25
```

Flags:

| Flag      | Description                                  |
|-----------|----------------------------------------------|
| `--since` | ISO timestamp filter (inclusive)             |
| `--until` | ISO timestamp filter (inclusive)             |
| `--scope` | Optional SavvyCal scope slug                 |
| `--limit` | Maximum events to import                     |
| `--batch` | Batch size when calling the webhook (default 20) |
| `--file`  | Use a local JSON file instead of the API     |

**File mode example**

```bash
npx tsx scripts/backfillSavvyCalLeads.ts --file ./fixtures/savvycal-events.json
```

The JSON can either be an array of webhook payloads or an object with a `data` array. Payloads must match SavvyCal’s webhook schema.

### 3. Verify Results

Run these SQL checks (via Supabase SQL editor or `psql`):

```sql
-- Confirm leads imported
SELECT id, contact_email, status, created_at
FROM leads
ORDER BY created_at DESC
LIMIT 20;

-- Inspect prep notes
SELECT lead_id, note_type, title, created_at
FROM lead_prep_notes
ORDER BY created_at DESC
LIMIT 20;
```

### 4. Generate Prep Guidance

After the backfill, queue the prep workflow so reps see enriched notes:

```bash
npx tsx scripts/backfillSavvyCalLeads.ts --limit 0  # no-op, useful just to load env vars
npm exec supabase functions invoke process-lead-prep --no-verify-jwt
```

Alternatively, trigger prep from the Leads inbox UI (`Generate Prep` button).

### 5. Troubleshooting

- **401 or 403 from SavvyCal** → Verify the token has `events:read`.
- **400 from Supabase function** → Check payload matches the webhook format; use `--file` mode to inspect.
- **RLS errors** → Ensure the edge functions use the service role key (they do by default).
- **Duplicate detection** → The webhook upsert is idempotent on `payload.id`. Re-running the script is safe.

### 6. Next Steps

1. Schedule the script (or translate it to a background job) if ongoing backfills are required.
2. Review the leads in `/leads` and ensure owners are correctly assigned.
3. Monitor analytics once events are in place (see `lead_source_summary` view).

