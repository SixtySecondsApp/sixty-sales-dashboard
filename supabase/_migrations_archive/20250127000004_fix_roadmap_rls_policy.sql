-- Drop the existing restrictive policy for users updating their own suggestions
DROP POLICY IF EXISTS "Users can update their own suggestions" ON roadmap_suggestions;

-- Create a new policy that allows users to update their own suggestions including status
CREATE POLICY "Users can update their own suggestions" ON roadmap_suggestions
  FOR UPDATE
  USING (submitted_by = auth.uid())
  WITH CHECK (
    submitted_by = auth.uid() AND
    -- Only allow updates to these specific fields
    (OLD.id = NEW.id) AND
    (OLD.submitted_by = NEW.submitted_by) AND
    (OLD.votes_count = NEW.votes_count) AND
    (OLD.created_at = NEW.created_at) AND
    (OLD.submitted_at = NEW.submitted_at) AND
    -- Allow these fields to be updated
    (OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to) AND
    (OLD.estimated_effort IS NOT DISTINCT FROM NEW.estimated_effort) AND
    (OLD.target_version IS NOT DISTINCT FROM NEW.target_version) AND
    (OLD.completion_date IS NOT DISTINCT FROM NEW.completion_date) AND
    (OLD.admin_notes IS NOT DISTINCT FROM NEW.admin_notes)
  );