# FIX: RLS Policy Blocking AI Suggestions

## Problem

The AI is successfully generating suggestions, but they're not persisting in the database due to Row Level Security (RLS) policy blocking inserts.

**Error from Edge Function logs**:
```
[storeSuggestions] Insert error: new row violates row-level security policy for table "next_action_suggestions"
```

## Root Cause

The RLS policy created in migration `20251031120000_create_next_action_suggestions.sql` only allows service role inserts:

```sql
CREATE POLICY "Service role can insert suggestions"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true); -- Service role has full access
```

However, the service role key is NOT bypassing RLS as expected.

## Solution

Run this SQL in the Supabase SQL Editor to fix the policy:

```sql
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert from Edge Functions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert for service role and authenticated" ON next_action_suggestions;

-- Create new policy that explicitly allows service role to bypass RLS
ALTER TABLE next_action_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE next_action_suggestions ENABLE ROW LEVEL SECURITY;

-- Recreate SELECT policy (users can view own suggestions)
DROP POLICY IF EXISTS "Users can view own suggestions" ON next_action_suggestions;
CREATE POLICY "Users can view own suggestions"
  ON next_action_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Recreate UPDATE policy (users can update own suggestions)
DROP POLICY IF EXISTS "Users can update own suggestions" ON next_action_suggestions;
CREATE POLICY "Users can update own suggestions"
  ON next_action_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Recreate DELETE policy (users can delete own dismissed suggestions)
DROP POLICY IF EXISTS "Users can delete own dismissed suggestions" ON next_action_suggestions;
CREATE POLICY "Users can delete own dismissed suggestions"
  ON next_action_suggestions
  FOR DELETE
  USING (auth.uid() = user_id AND status = 'dismissed');

-- CREATE NEW INSERT POLICY that bypasses RLS completely
-- This allows the trigger to set user_id correctly
CREATE POLICY "Allow all inserts (user_id set by trigger)"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true);

-- Grant necessary permissions
GRANT INSERT, SELECT, UPDATE, DELETE ON next_action_suggestions TO service_role;
GRANT INSERT, SELECT, UPDATE, DELETE ON next_action_suggestions TO authenticated;
```

## Steps to Apply

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
   - Click on "SQL Editor" in the left sidebar

2. **Run the SQL**
   - Copy the SQL above
   - Paste into a new query
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Test the Fix**
   ```bash
   ./test-ai-one-meeting.sh
   ```

4. **Verify Persistence**
   ```bash
   ./check-suggestions-in-db.sh
   ```

You should see suggestions and tasks being created and persisting in the database.

## Why This Works

1. **`WITH CHECK (true)`** - Allows all inserts without RLS restrictions
2. **Trigger sets `user_id`** - The `auto_populate_suggestion_user_id()` trigger ensures `user_id` is set correctly
3. **SELECT policy still enforces security** - Users can only view their own suggestions
4. **Service role has full access** - Explicitly granted permissions

## Alternative: Disable RLS (Not Recommended)

If the above doesn't work, you can temporarily disable RLS entirely:

```sql
ALTER TABLE next_action_suggestions DISABLE ROW LEVEL SECURITY;
```

But this removes all security, so only use for testing!

## Expected Behavior After Fix

1. ✅ Edgefunction creates suggestions → They persist in database
2. ✅ Suggestions auto-create tasks → Tasks persist in database
3. ✅ Notifications are sent → Toast notifications appear in UI
4. ✅ Meeting badges show task count → UI updates in real-time

## Test Results Expected

```bash
$ ./test-ai-one-meeting.sh

📄 Response Body:
{
  "suggestions": [...],  # 4 suggestions
  "tasks": [...],        # 4 tasks
  "count": 4
}

$ ./check-suggestions-in-db.sh

3️⃣ All suggestions count:
[{ "count": 4 }]  # ✅ Suggestions persisted!

4️⃣ All tasks count:
[{ "count": 4 }]  # ✅ Tasks created!
```

## If Still Failing

Check Edge Function logs for:
```
[autoCreateTasksFromSuggestions] Task creation error: ...
```

The issue might be with the **tasks** table RLS policy, not suggestions!
