# Check Webhook 401 Error Details

## Where to Find the Error Message

Go to: **Supabase Dashboard → Edge Functions → fathom-webhook → Logs**

Find the entry from: **2025-12-02 20:18:38**

Look for:
1. **Response Body** - Should contain the actual error message
2. **Console Logs** - Should show the improved logging I added

## What You Should See

If the improved webhook is working, you should see logs like:
```
[abc123] Webhook received: { recording_id: "...", recorded_by: "email@example.com" }
[abc123] Looking up user by email: email@example.com
```

If you DON'T see these logs, the function deployment might have failed.

## Quick Check

The response has `content_length: "73"` which means there's a 73-byte error message.
It might say something like:
- `{"error": "Unauthorized"}`
- `{"error": "Missing authorization"}`
- `{"error": "Invalid request"}`

**Can you check the Logs tab and share:**
1. The full error response body
2. Any console logs from that timestamp
