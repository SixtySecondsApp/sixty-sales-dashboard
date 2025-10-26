-- Fix Meetings RLS Policies
-- Issue: Permission denied errors when querying meetings with company joins

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings they own" ON meetings;
DROP POLICY IF EXISTS "Users can manage their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "Service role has full access to meetings" ON meetings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON meetings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON meetings;
DROP POLICY IF EXISTS "Enable update for users based on owner_user_id" ON meetings;
DROP POLICY IF EXISTS "Enable delete for users based on owner_user_id" ON meetings;

-- Enable RLS on meetings table
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create simple, working RLS policies for meetings
CREATE POLICY "meetings_select_policy" ON meetings
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
  );

CREATE POLICY "meetings_insert_policy" ON meetings
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
  );

CREATE POLICY "meetings_update_policy" ON meetings
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "meetings_delete_policy" ON meetings
  FOR DELETE
  USING (owner_user_id = auth.uid());

-- Service role bypass (for Edge Functions)
CREATE POLICY "meetings_service_role_all" ON meetings
  FOR ALL
  USING (
    auth.role() = 'service_role'
  );

-- Fix Companies RLS if needed (for joins to work)
DROP POLICY IF EXISTS "Users can view companies they own" ON companies;
DROP POLICY IF EXISTS "Users can manage companies they own" ON companies;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable update for users based on owner_id" ON companies;
DROP POLICY IF EXISTS "Enable delete for users based on owner_id" ON companies;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_policy" ON companies
  FOR SELECT
  USING (
    owner_id = auth.uid()
  );

CREATE POLICY "companies_insert_policy" ON companies
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
  );

CREATE POLICY "companies_update_policy" ON companies
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "companies_delete_policy" ON companies
  FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "companies_service_role_all" ON companies
  FOR ALL
  USING (
    auth.role() = 'service_role'
  );

-- Fix Meeting Action Items RLS
DROP POLICY IF EXISTS "Users can view action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can manage action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON meeting_action_items;

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_select_policy" ON meeting_action_items
  FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "action_items_insert_policy" ON meeting_action_items
  FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "action_items_update_policy" ON meeting_action_items
  FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "action_items_delete_policy" ON meeting_action_items
  FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "action_items_service_role_all" ON meeting_action_items
  FOR ALL
  USING (
    auth.role() = 'service_role'
  );

-- Verify policies were created
SELECT
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename IN ('meetings', 'companies', 'meeting_action_items')
ORDER BY tablename, policyname;

COMMENT ON POLICY "meetings_select_policy" ON meetings IS 'Users can view their own meetings';
COMMENT ON POLICY "companies_select_policy" ON companies IS 'Users can view companies they own';
COMMENT ON POLICY "action_items_select_policy" ON meeting_action_items IS 'Users can view action items for their meetings';
