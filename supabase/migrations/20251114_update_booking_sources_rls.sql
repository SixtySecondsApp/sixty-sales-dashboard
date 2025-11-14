-- Update RLS policies for booking_sources to allow authenticated users to manage them
-- This enables the admin UI to add/edit/delete booking sources

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage booking sources" ON booking_sources;

-- Allow authenticated users to insert, update, and delete booking sources
CREATE POLICY "Authenticated users can manage booking sources"
  ON booking_sources FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Keep the view policy for all authenticated users
-- (Already exists, but ensuring it's there)
DROP POLICY IF EXISTS "Users can view booking sources" ON booking_sources;
CREATE POLICY "Users can view booking sources"
  ON booking_sources FOR SELECT
  TO authenticated
  USING (true);

