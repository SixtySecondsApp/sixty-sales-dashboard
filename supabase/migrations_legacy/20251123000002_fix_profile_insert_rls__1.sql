-- Fix: Allow service_role to INSERT profiles via the handle_new_user trigger
-- This fixes the "Database error granting user" authentication error

-- Drop any conflicting insert policies
DROP POLICY IF EXISTS "Enable profile insert for service role" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow service role to create profiles" ON profiles;

-- Create INSERT policy that allows:
-- 1. service_role (for the handle_new_user trigger)
-- 2. Users creating their own profile
CREATE POLICY "Enable profile creation"
  ON profiles FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    -- Allow service_role (for triggers)
    auth.role() = 'service_role'
    OR
    -- Allow users to create their own profile
    auth.uid() = id
  );

-- Recreate the function (idempotent)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    new.id,
    COALESCE(split_part(new.raw_user_meta_data->>'full_name', ' ', 1), ''),
    COALESCE(split_part(new.raw_user_meta_data->>'full_name', ' ', 2), ''),
    new.email,
    'Trainee'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it's correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
