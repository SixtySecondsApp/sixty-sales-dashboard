-- Create waitlist_admin_actions table for audit trail
-- This table was referenced in code but never created

-- Ensure is_admin_optimized() function exists and uses correct column (is_admin, not is_platform_admin)
CREATE OR REPLACE FUNCTION public.is_admin_optimized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
$$;

-- Create waitlist_admin_actions table
CREATE TABLE IF NOT EXISTS waitlist_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('grant_access', 'adjust_position', 'send_email', 'export_data', 'status_change', 'notes_update', 'release', 'unrelease')),
  action_details JSONB,
  previous_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_actions_entry_id ON waitlist_admin_actions(waitlist_entry_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON waitlist_admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON waitlist_admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON waitlist_admin_actions(created_at DESC);

-- Enable RLS
ALTER TABLE waitlist_admin_actions ENABLE ROW LEVEL SECURITY;

-- RLS policy: Only admins can view admin actions
DROP POLICY IF EXISTS "Admins can view waitlist admin actions" ON waitlist_admin_actions;
CREATE POLICY "Admins can view waitlist admin actions"
  ON waitlist_admin_actions
  FOR SELECT
  TO authenticated
  USING (
    is_service_role() OR is_admin_optimized()
  );

-- RLS policy: Only admins can insert admin actions
DROP POLICY IF EXISTS "Admins can insert waitlist admin actions" ON waitlist_admin_actions;
CREATE POLICY "Admins can insert waitlist admin actions"
  ON waitlist_admin_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_service_role() OR is_admin_optimized()
  );

-- Grant access to authenticated users (RLS will handle permissions)
GRANT SELECT, INSERT ON waitlist_admin_actions TO authenticated;
