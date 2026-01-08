-- Fix infinite recursion in meetings RLS policies
-- Drop the problematic policies first
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view team meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;

-- Create simplified, non-recursive policies
-- For now, users can only see and manage their own meetings
-- Team sharing can be added later with a proper team management table
CREATE POLICY "Users can view their own meetings" ON meetings
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own meetings" ON meetings
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own meetings" ON meetings
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own meetings" ON meetings
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Also fix the related tables that reference meetings with similar recursion issues
-- Meeting attendees
DROP POLICY IF EXISTS "View attendees for accessible meetings" ON meeting_attendees;
DROP POLICY IF EXISTS "Manage attendees for own meetings" ON meeting_attendees;

CREATE POLICY "View attendees for own meetings" ON meeting_attendees
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Manage attendees for own meetings" ON meeting_attendees
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting action items
DROP POLICY IF EXISTS "View action items for accessible meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Manage action items for own meetings" ON meeting_action_items;

CREATE POLICY "View action items for own meetings" ON meeting_action_items
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Manage action items for own meetings" ON meeting_action_items
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting topics
DROP POLICY IF EXISTS "View topics for accessible meetings" ON meeting_topics;
DROP POLICY IF EXISTS "Manage topics for own meetings" ON meeting_topics;

CREATE POLICY "View topics for own meetings" ON meeting_topics
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Manage topics for own meetings" ON meeting_topics
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting metrics
DROP POLICY IF EXISTS "View metrics for accessible meetings" ON meeting_metrics;
DROP POLICY IF EXISTS "Manage metrics for own meetings" ON meeting_metrics;

CREATE POLICY "View metrics for own meetings" ON meeting_metrics
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Manage metrics for own meetings" ON meeting_metrics
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- For development/testing: Also create a policy for webhook access (service role bypasses RLS)
-- This ensures the webhook function can insert/update meetings
-- The webhook function uses service_role key which bypasses RLS, so this is just for documentation