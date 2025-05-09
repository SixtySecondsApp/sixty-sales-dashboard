/*
  # Fix activities table structure

  1. Changes
    - Drop and recreate activities table with correct structure
    - Add proper indexes
    - Update RLS policies

  2. Security
    - Maintain RLS policies for data protection
*/

-- Drop existing table and recreate with correct structure
DROP TABLE IF EXISTS activities CASCADE;

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('sale', 'outbound', 'meeting', 'proposal')) NOT NULL,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')) NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')) NOT NULL,
  client_name text NOT NULL,
  sales_rep text NOT NULL,
  details text,
  amount decimal(12,2),
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX activities_user_id_idx ON activities(user_id);
CREATE INDEX activities_type_idx ON activities(type);
CREATE INDEX activities_date_idx ON activities(date);
CREATE INDEX activities_sales_rep_idx ON activities(sales_rep);
CREATE INDEX activities_client_name_idx ON activities(client_name);

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Create policies
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