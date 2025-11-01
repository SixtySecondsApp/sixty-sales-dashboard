## Fathom Auto-Trigger Test Guide

Test the complete automatic flow: Fathom webhook → transcript fetch → automatic AI suggestion generation

## Prerequisites

1. ✅ Apply the migration to update trigger functions:

```bash
# Run this migration
psql "$DATABASE_URL" -f supabase/migrations/20251031000005_update_triggers_to_use_system_config.sql
```

This updates the trigger functions to use `system_config` table instead of `current_setting()`.

## Test Scenario 1: Manual Trigger Simulation

Simulate what happens when fathom-sync fetches a transcript:

### Step 1: Find a meeting without suggestions

```sql
SELECT
  id,
  title,
  LENGTH(transcript_text) as transcript_length,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE transcript_text IS NOT NULL
  AND next_actions_generated_at IS NULL
LIMIT 1;
```

### Step 2: Trigger the automatic flow

Copy the meeting ID from Step 1 and run:

```sql
UPDATE meetings
SET
  transcript_text = transcript_text,  -- Forces UPDATE OF transcript_text trigger
  updated_at = NOW()
WHERE id = 'YOUR-MEETING-ID-HERE';
```

**Expected**: Database trigger should fire and queue suggestion generation

### Step 3: Wait and verify (10-15 seconds)

```sql
-- Check for auto-generated suggestions
SELECT
  id,
  title,
  action_type,
  urgency,
  confidence_score,
  status,
  created_at
FROM next_action_suggestions
WHERE activity_id = 'YOUR-MEETING-ID-HERE'
ORDER BY urgency DESC;

-- Verify meeting metadata updated
SELECT
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = 'YOUR-MEETING-ID-HERE';
```

**Expected**:
- ✅ 3-5 suggestions created
- ✅ `next_actions_count` > 0
- ✅ `next_actions_generated_at` timestamp set

## Test Scenario 2: Real Fathom Webhook

Trigger a real Fathom webhook to test end-to-end:

### Option A: Use existing webhook endpoint

If you have the fathom-webhook Edge Function deployed:

```bash
# Get a recent Fathom recording ID
psql "$DATABASE_URL" -c "
SELECT fathom_recording_id, title
FROM meetings
WHERE fathom_recording_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
"

# Manually trigger the webhook
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "event": "recording.ready",
    "recording_id": "YOUR-FATHOM-RECORDING-ID"
  }'
```

### Option B: Call fathom-sync directly

```bash
# Call fathom-sync Edge Function for a specific meeting
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
  -H 'Authorization: Bearer YOUR-SERVICE-ROLE-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "sync_single",
    "recordingId": "YOUR-FATHOM-RECORDING-ID"
  }'
```

## Test Scenario 3: New Meeting Creation

Test the INSERT trigger (when a NEW meeting with transcript is created):

```sql
-- This simulates what happens when fathom-sync creates a meeting WITH transcript
INSERT INTO meetings (
  fathom_recording_id,
  title,
  owner_user_id,
  transcript_text,
  summary,
  meeting_start
) VALUES (
  'test-recording-' || gen_random_uuid()::text,
  'Test Meeting for Auto-Trigger',
  (SELECT id FROM auth.users LIMIT 1),  -- Use your user ID
  'This is a test transcript with enough content to trigger suggestion generation. The meeting discussed product roadmap, pricing strategy, and next steps for the customer.',
  'Test meeting summary',
  NOW()
) RETURNING id;

-- Copy the returned ID and check for suggestions after 10-15 seconds
```

## Troubleshooting

### Issue 1: No suggestions created

**Check trigger execution**:
```sql
-- Enable notice messages to see trigger logs
SET client_min_messages TO NOTICE;

-- Then run the UPDATE test again
UPDATE meetings
SET transcript_text = transcript_text
WHERE id = 'YOUR-MEETING-ID';

-- You should see: "NOTICE: Queued next-action suggestion..."
```

**Check Edge Function logs**:
Dashboard → https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/suggest-next-actions/logs

### Issue 2: Trigger fires but suggestions fail

**Check pg_net queue**:
```sql
SELECT * FROM extensions.http_request_queue
ORDER BY id DESC
LIMIT 5;
```

**Check for function errors**:
```sql
-- Test the async function directly
SELECT call_suggest_next_actions_async(
  'YOUR-MEETING-ID'::uuid,
  'meeting',
  (SELECT owner_user_id FROM meetings WHERE id = 'YOUR-MEETING-ID')
);
```

### Issue 3: System config missing

**Verify config is set**:
```sql
SELECT key, LEFT(value, 50) as value_preview
FROM system_config
WHERE key IN ('supabase_url', 'service_role_key');
```

If missing, set them:
```sql
-- Set URL
INSERT INTO system_config (key, value, description)
VALUES (
  'supabase_url',
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'Supabase project URL for Edge Functions'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Set service role key
INSERT INTO system_config (key, value, description)
VALUES (
  'service_role_key',
  'YOUR-SERVICE-ROLE-KEY-HERE',
  'Service role key for Edge Function authentication'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## Success Criteria

- [x] Migration applied successfully
- [ ] Manual UPDATE triggers suggestion generation
- [ ] Fathom webhook creates suggestions automatically
- [ ] New meeting INSERT triggers suggestion generation
- [ ] Cooldown period prevents duplicate generation (1 hour)
- [ ] Meeting metadata updates correctly

## Expected Flow

1. **Fathom sync** fetches transcript → Updates `meetings.transcript_text`
2. **Database trigger** fires → Calls `call_suggest_next_actions_async()`
3. **pg_net** queues HTTP request → Returns request_id
4. **Edge Function** receives request → Fetches context
5. **Claude AI** analyzes transcript → Generates suggestions
6. **Edge Function** inserts suggestions → Database
7. **Trigger** updates meeting counts → `next_actions_count` incremented

---

**Status**: Ready for testing
**Date**: October 31, 2025
