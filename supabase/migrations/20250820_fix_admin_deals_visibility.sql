-- Fix admin visibility for deals during impersonation
-- This migration updates RLS policies to allow admins to see all deals

-- First, drop existing restrictive policies for deals
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new RLS policies with admin access
-- View policy: Admins can see all deals, regular users see only their own
CREATE POLICY "Users can view deals" ON deals FOR SELECT USING (
  owner_id = auth.uid() 
  OR auth.is_admin()
);

-- Insert policy: Anyone can insert deals they own
CREATE POLICY "Users can insert own deals" ON deals FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);

-- Update policy: Admins can update any deal, regular users only their own
CREATE POLICY "Users can update deals" ON deals FOR UPDATE USING (
  owner_id = auth.uid() 
  OR auth.is_admin()
);

-- Delete policy: Admins can delete any deal, regular users only their own
CREATE POLICY "Users can delete deals" ON deals FOR DELETE USING (
  owner_id = auth.uid() 
  OR auth.is_admin()
);

-- Update deal_activities policies to match
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can insert deal activities" ON deal_activities;

CREATE POLICY "Users can view deal activities" ON deal_activities FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "Users can insert deal activities" ON deal_activities FOR INSERT WITH CHECK (
  user_id = auth.uid() 
  AND (
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
    OR auth.is_admin()
  )
);

-- Update deal_stage_history policies to match
DROP POLICY IF EXISTS "Users can view their deal stage history" ON deal_stage_history;

CREATE POLICY "Users can view deal stage history" ON deal_stage_history FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

-- Update deal_splits policies to match
DROP POLICY IF EXISTS "Users can view splits for their deals" ON deal_splits;
DROP POLICY IF EXISTS "Users can create splits for own deals" ON deal_splits;
DROP POLICY IF EXISTS "Users can update splits for own deals" ON deal_splits;
DROP POLICY IF EXISTS "Users can delete splits for own deals" ON deal_splits;

CREATE POLICY "Users can view deal splits" ON deal_splits FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "Users can create deal splits" ON deal_splits FOR INSERT WITH CHECK (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "Users can update deal splits" ON deal_splits FOR UPDATE USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

CREATE POLICY "Users can delete deal splits" ON deal_splits FOR DELETE USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  OR auth.is_admin()
);

-- Also update activities table to allow admin visibility
DROP POLICY IF EXISTS "Users can only view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can only insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can only update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can only delete their own activities" ON activities;

CREATE POLICY "Users can view activities" ON activities FOR SELECT USING (
  user_id = auth.uid()
  OR auth.is_admin()
);

CREATE POLICY "Users can insert activities" ON activities FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can update activities" ON activities FOR UPDATE USING (
  user_id = auth.uid()
  OR auth.is_admin()
);

CREATE POLICY "Users can delete activities" ON activities FOR DELETE USING (
  user_id = auth.uid()
  OR auth.is_admin()
);

-- Update clients table policies for admin access
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;

CREATE POLICY "Users can view clients" ON clients FOR SELECT USING (
  true -- All users can view clients (they're company-wide)
);

CREATE POLICY "Users can insert clients" ON clients FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL -- Any authenticated user can insert
);

CREATE POLICY "Users can update clients" ON clients FOR UPDATE USING (
  auth.uid() IS NOT NULL -- Any authenticated user can update
);

CREATE POLICY "Users can delete clients" ON clients FOR DELETE USING (
  auth.is_admin() -- Only admins can delete
);

-- Grant execute permission on the is_admin function
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION auth.is_admin() IS 'Checks if the current user is an admin. Used in RLS policies to grant admin users full access.';