# Debug Edge Function - No Suggestions Created

## Current Status

✅ HTTP requests queued successfully (request_id: 4)
❌ No suggestions created in database

## Debugging Steps

### Step 1: Check pg_net Request Queue

Run this SQL to see the status of queued HTTP requests:

```sql
SELECT
  id as request_id,
  method,
  url,
  created,
  status,
  status_text,
  response_headers,
  response_body
FROM net.http_request_queue
ORDER BY created DESC
LIMIT 10;
```

**What to look for**:
- `status`: Should show HTTP status code (200 = success, 4xx/5xx = error)
- `status_text`: Error message if failed
- `response_body`: Response from Edge Function

### Step 2: Check Edge Function Logs via Dashboard

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/suggest-next-actions
2. Click on "Logs" tab
3. Look for recent invocations (should show request_id 4)
4. Check for error messages

### Step 3: Manually Invoke Edge Function

Test the Edge Function directly with curl:

```bash
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/suggest-next-actions' \
  -H 'Authorization: Bearer YOUR-SERVICE-ROLE-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "activityId": "72b97f50-a2a9-412e-8ed4-37f0b78ff811",
    "activityType": "meeting",
    "userId": "YOUR-USER-ID",
    "forceRegenerate": true
  }'
```

**Replace**:
- `YOUR-SERVICE-ROLE-KEY`: Get from system_config table
- `YOUR-USER-ID`: Get from meetings table (owner_user_id for the Jean-Marc meeting)

### Step 4: Get User ID for Test

```sql
SELECT
  id,
  title,
  owner_user_id
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
```

## Common Issues to Check

### Issue 1: Service Role Key Incorrect
**Symptom**: 401 Unauthorized errors in pg_net logs
**Fix**: Verify service_role_key in system_config matches .env file

### Issue 2: Edge Function Timeout
**Symptom**: No response, status null in pg_net queue
**Fix**: AI model may be taking too long, check timeout settings

### Issue 3: Database Permission Error
**Symptom**: Edge Function runs but can't insert suggestions
**Fix**: Check RLS policies on next_action_suggestions table

### Issue 4: Missing User ID
**Symptom**: Edge Function errors because userId is null
**Fix**: Ensure get_user_id_from_activity() returns valid user

### Issue 5: AI API Error
**Symptom**: Edge Function receives request but AI call fails
**Fix**: Check Anthropic API key configuration in Edge Function secrets

## Next Steps

1. **Run Step 1 query** to check pg_net request status
2. **Share results** so we can diagnose the issue
3. **Check Dashboard logs** for detailed error messages
4. **Test manual invocation** if pg_net shows errors

---

**Current Meeting**: Jean-Marc (ID: 72b97f50-a2a9-412e-8ed4-37f0b78ff811)
**Request ID**: 4
**Expected**: Suggestions created, but got 0
