-- Fix RLS policy for next_action_suggestions to allow Edge Function inserts
-- The Edge Function uses service role internally, but the policy needs adjustment

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;

-- Create new policy that allows inserts from Edge Functions
-- Edge Functions running with service role credentials can bypass RLS
-- But we also need to allow authenticated users to insert via the trigger
CREATE POLICY "Allow insert for service role and authenticated"
  ON next_action_suggestions
  FOR INSERT
  TO service_role, authenticated
  WITH CHECK (true);

-- Alternative: If the above doesn't work, we can make the insert completely open
-- and rely on the trigger to set the correct user_id
-- DROP POLICY IF EXISTS "Allow insert for service role and authenticated" ON next_action_suggestions;
-- CREATE POLICY "Allow insert from Edge Functions"
--   ON next_action_suggestions
--   FOR INSERT
--   WITH CHECK (true);
