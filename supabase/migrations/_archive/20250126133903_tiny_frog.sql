-- Drop existing function that may cause issues
DROP FUNCTION IF EXISTS handle_profile_image_cleanup CASCADE;

-- Create storage bucket for profile images if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('profile-images', 'profile-images', true)
  ON CONFLICT (id) DO UPDATE
  SET public = true;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- Set up storage policies
DO $$
BEGIN
  -- View policy (public bucket, so no need for view policy)
  DROP POLICY IF EXISTS "Users can view own profile image" ON storage.objects;

  -- Upload policy
  DROP POLICY IF EXISTS "Users can upload own profile image" ON storage.objects;
  CREATE POLICY "Users can upload own profile image"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images' AND
    auth.uid()::text = split_part(name, '/', 1) AND
    (LOWER(split_part(name, '.', -1)) IN ('jpg', 'jpeg', 'png', 'gif'))
  );

  -- Update policy
  DROP POLICY IF EXISTS "Users can update own profile image" ON storage.objects;
  CREATE POLICY "Users can update own profile image"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = split_part(name, '/', 1)
  );

  -- Delete policy
  DROP POLICY IF EXISTS "Users can delete own profile image" ON storage.objects;
  CREATE POLICY "Users can delete own profile image"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = split_part(name, '/', 1)
  );
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;