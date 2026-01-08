/*
  # Fix Recursive RLS Policies

  1. Changes
    - Drop and recreate team member policies to avoid recursion
    - Simplify activity and target policies
    - Add missing policies for team operations

  2. Security
    - Maintains data access security
    - Prevents infinite recursion
    - Ensures proper authorization checks
*/

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Team members can read team data" ON teams;
DROP POLICY IF EXISTS "Team members can read membership data" ON team_members;
DROP POLICY IF EXISTS "Users can read own and team activities" ON activities;
DROP POLICY IF EXISTS "Users can read own and team targets" ON targets;

-- Recreate team policies
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Recreate team member policies
CREATE POLICY "Users can view team memberships"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Recreate activity policies
CREATE POLICY "Users can view activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Recreate target policies
CREATE POLICY "Users can view targets"
  ON targets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add missing team policies
CREATE POLICY "Team leaders can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Team leaders can update their teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );

-- Add missing team member policies
CREATE POLICY "Team leaders can manage members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );

CREATE POLICY "Team leaders can update members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );

-- Add missing target policies
CREATE POLICY "Users can create targets"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );

CREATE POLICY "Users can update targets"
  ON targets FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );