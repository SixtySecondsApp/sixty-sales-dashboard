/*
  # Initial Schema Setup

  1. New Tables
    - `profiles`
      - Extends Supabase auth.users
      - Stores additional user information
      - Links to auth.users via foreign key
    
    - `teams`
      - Represents sales teams
      - Tracks team performance metrics
    
    - `team_members`
      - Links users to teams
      - Tracks member roles
    
    - `activities`
      - Stores all sales activities
      - Links to users and teams
      - Includes type, status, and metrics
    
    - `targets`
      - Stores performance targets
      - Can be set for users or teams
    
  2. Security
    - Enable RLS on all tables
    - Policies for authenticated access
    - Team-based access control
*/

-- Create custom types
CREATE TYPE activity_type AS ENUM ('outbound', 'meeting', 'proposal', 'sale');
CREATE TYPE activity_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE activity_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE member_role AS ENUM ('member', 'leader', 'admin');

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text UNIQUE NOT NULL,
  stage text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create teams table
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_members table
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create activities table
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  status activity_status DEFAULT 'pending',
  priority activity_priority DEFAULT 'medium',
  client_name text NOT NULL,
  details text,
  amount decimal(12,2),
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  avatar_url text
);

-- Create targets table
CREATE TABLE targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  revenue_target decimal(12,2) NOT NULL,
  outbound_target integer NOT NULL,
  meetings_target integer NOT NULL,
  proposal_target integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (user_id IS NOT NULL OR team_id IS NOT NULL),
  CHECK (start_date <= end_date)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Team members can read team data"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can read membership data"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('leader', 'admin')
    )
  );

CREATE POLICY "Users can read own and team activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own and team targets"
  ON targets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = targets.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Create functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    new.id,
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    split_part(new.raw_user_meta_data->>'full_name', ' ', 2),
    new.email,
    'Trainee'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();