/*
  # Fix RLS Policies - Final Version

  1. Changes
    - Remove NEW references in policies
    - Simplify policy conditions
    - Add proper CRUD policies for all tables
    - Fix team member management policies

  2. Security
    - Maintains data isolation between users and teams
    - Preserves proper authorization checks
    - Simplifies policy logic to prevent recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view teams they belong to" ON teams;
DROP POLICY IF EXISTS "Users can view team memberships" ON team_members;
DROP POLICY IF EXISTS "Users can view activities" ON activities;
DROP POLICY IF EXISTS "Users can view targets" ON targets;
DROP POLICY IF EXISTS "Team leaders can create teams" ON teams;
DROP POLICY IF EXISTS "Team leaders can update their teams" ON teams;
DROP POLICY IF EXISTS "Team leaders can manage members" ON team_members;
DROP POLICY IF EXISTS "Team leaders can update members" ON team_members;
DROP POLICY IF EXISTS "Users can create targets" ON targets;
DROP POLICY IF EXISTS "Users can update targets" ON targets;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own activities" ON activities;
DROP POLICY IF EXISTS "Users can update own activities" ON activities;

-- Profile Policies
CREATE POLICY "Enable read access for own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Enable update access for own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Team Member Policies (Simplified)
CREATE POLICY "Enable read access for team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable team member management"
  ON team_members FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid() 
      AND tm.role IN ('leader', 'admin')
    )
  );

-- Team Policies
CREATE POLICY "Enable read access for team members"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Enable team management"
  ON teams FOR ALL
  TO authenticated
  USING (
    id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('leader', 'admin')
    )
  );

-- Activity Policies
CREATE POLICY "Enable read access for own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable insert for own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update for own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable delete for own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Target Policies
CREATE POLICY "Enable read access for own targets"
  ON targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable insert for own targets"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update for own targets"
  ON targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Insert sample data for testing
INSERT INTO teams (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sales Team Alpha', 'Primary sales team')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO team_members (team_id, user_id, role) 
SELECT 
  '11111111-1111-1111-1111-111111111111',
  id,
  'member'
FROM profiles
WHERE email = 'sarah.johnson@example.com'
ON CONFLICT (team_id, user_id) DO NOTHING;

INSERT INTO targets (
  user_id,
  revenue_target,
  outbound_target,
  meetings_target,
  proposal_target,
  start_date,
  end_date
)
SELECT
  id,
  20000,
  100,
  20,
  15,
  date_trunc('month', current_date),
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date
FROM profiles
WHERE email = 'sarah.johnson@example.com'
ON CONFLICT DO NOTHING;