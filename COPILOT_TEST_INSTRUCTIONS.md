# Copilot Haiku 4.5 Test Instructions

## ✅ Deployment Status
- Edge Function: `api-copilot` deployed
- Model: `claude-haiku-4-5` (Claude Haiku 4.5)
- Endpoint: `/functions/v1/api-copilot/chat`

## 🧪 How to Test

### Option 1: Test via the Application UI (Recommended)

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Navigate to the Copilot**:
   - Open the app in your browser
   - Click "AI Copilot" in the sidebar (or go to `/copilot`)
   - Or press `⌘K` (or `Ctrl+K`) to open Smart Search and type a query

3. **Test MCP Tools with these queries**:

   **Test Meetings Read:**
   ```
   Show me my meetings from the last week with their transcripts and action items
   ```

   **Test Pipeline Read:**
   ```
   What deals do I have in my pipeline? Show me the top 5 by value
   ```

   **Test Tasks Create:**
   ```
   Create a task to follow up with a client tomorrow
   ```

   **Test Activities Read:**
   ```
   Show me my recent sales activities
   ```

   **Test Leads Read:**
   ```
   Find all contacts at TechCorp
   ```

   **Test Calendar Read:**
   ```
   What calendar events do I have this week?
   ```

### Option 2: Check Edge Function Logs

1. **View logs in Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
   - Click on `api-copilot`
   - View recent invocations and logs

2. **Check for model name errors**:
   - If you see errors about model name, the model identifier might need to be adjusted
   - Current model: `claude-haiku-4-5`
   - Alternative formats to try if needed:
     - `claude-3-5-haiku-20241022`
     - `claude-3-haiku-20240307`

### Option 3: Browser Console Test

1. **Open browser console** on any page of the app
2. **Run this test**:

```javascript
// Get your auth token
const { data: { session } } = await window.supabase.auth.getSession();
const token = session?.access_token;

// Test the Copilot
const response = await fetch('https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/api-copilot/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: 'Show me my meetings from last week',
    context: {}
  })
});

const data = await response.json();
console.log('Response:', data);
```

## 🔍 What to Look For

### Success Indicators:
- ✅ Response contains `content` field with AI-generated text
- ✅ Tool calls are executed (check logs for `Executing tool: meetings_read`, etc.)
- ✅ Response time is fast (Haiku is faster than Sonnet)
- ✅ No model name errors in logs

### Error Indicators:
- ❌ `400 Bad Request` - Check model name format
- ❌ `401 Unauthorized` - Authentication issue
- ❌ `429 Too Many Requests` - Rate limit exceeded
- ❌ `500 Internal Server Error` - Check Edge Function logs

## 📊 Expected Behavior

1. **User sends message** → Edge Function receives request
2. **Claude Haiku 4.5 analyzes** → Decides which MCP tools to use
3. **Tools execute** → CRUD operations run (meetings_read, pipeline_read, etc.)
4. **Results returned** → Claude formats response with tool results
5. **User sees response** → Natural language summary with data

## 🐛 Troubleshooting

### Model Name Error
If you see errors about the model name:
1. Check Edge Function logs for exact error
2. Try alternative model identifiers:
   - `claude-3-5-haiku-20241022`
   - `claude-3-haiku-20240307`
3. Update `supabase/functions/api-copilot/index.ts` line 897 and 993

### Authentication Error
- Ensure you're logged into the app
- Check that `ANTHROPIC_API_KEY` is set in Supabase secrets
- Verify JWT token is being sent correctly

### Rate Limit Error
- Current limit: 100 requests/hour per user
- Wait for the rate limit window to reset
- Check `X-RateLimit-Remaining` header in response

## ✅ Verification Checklist

- [ ] Edge Function deployed successfully
- [ ] Model name set to `claude-haiku-4-5`
- [ ] Can send simple chat message
- [ ] MCP tools are being called (check logs)
- [ ] Tool results are returned correctly
- [ ] Response time is acceptable (< 5 seconds)
- [ ] No errors in Edge Function logs

## 🎯 Next Steps

Once testing is successful:
1. Monitor Edge Function logs for any issues
2. Check API costs (Haiku should be cheaper than Sonnet)
3. Verify all CRUD operations work correctly
4. Test edge cases (empty results, errors, etc.)






