/*
  # Sales Schema Update

  1. Tables
    - activities: Track sales activities with client info and metrics
    - targets: Store monthly performance targets

  2. Security
    - Drop existing policies to avoid conflicts
    - Create new policies for authenticated users
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for own activities" ON activities;
DROP POLICY IF EXISTS "Enable insert for own activities" ON activities;
DROP POLICY IF EXISTS "Enable update for own activities" ON activities;
DROP POLICY IF EXISTS "Enable delete for own activities" ON activities;
DROP POLICY IF EXISTS "Enable read access for own targets" ON targets;
DROP POLICY IF EXISTS "Enable insert for own targets" ON targets;
DROP POLICY IF EXISTS "Enable update for own targets" ON targets;

-- Create activities table if it doesn't exist
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  status activity_status DEFAULT 'completed',
  priority activity_priority DEFAULT 'medium',
  client_name text NOT NULL,
  details text,
  amount decimal(12,2),
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create targets table if it doesn't exist
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  revenue_target decimal(12,2) NOT NULL DEFAULT 20000,
  outbound_target integer NOT NULL DEFAULT 100,
  meetings_target integer NOT NULL DEFAULT 20,
  proposal_target integer NOT NULL DEFAULT 15,
  start_date date NOT NULL DEFAULT date_trunc('month', current_date),
  end_date date NOT NULL DEFAULT (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (start_date <= end_date)
);

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- Create new policies for activities
CREATE POLICY "Users can read own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create new policies for targets
CREATE POLICY "Users can read own targets"
  ON targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own targets"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own targets"
  ON targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());