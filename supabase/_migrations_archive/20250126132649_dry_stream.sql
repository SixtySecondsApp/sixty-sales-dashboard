/*
  # Profile Image Storage Setup

  1. Changes
    - Create storage bucket for profile images
    - Add storage policies for secure access
    - Add trigger for profile image cleanup

  2. Security
    - Only allow authenticated users to access their own images
    - Enforce file type restrictions (jpg, jpeg, png, gif)
    - Secure file management with RLS policies
*/

-- Create storage bucket for profile images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Users can view own profile image"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own profile image"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (LOWER(storage.extension(name)) = 'jpg' OR
   LOWER(storage.extension(name)) = 'jpeg' OR
   LOWER(storage.extension(name)) = 'png' OR
   LOWER(storage.extension(name)) = 'gif')
);

CREATE POLICY "Users can update own profile image"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own profile image"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Function to handle profile image cleanup
CREATE OR REPLACE FUNCTION handle_profile_image_cleanup()
RETURNS trigger AS $$
BEGIN
  -- Delete old image if it exists and new image is different
  IF OLD.avatar_url IS NOT NULL AND OLD.avatar_url != NEW.avatar_url THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'profile-images'
    AND name LIKE auth.uid() || '/%'
    AND url_path(name) != url_path(NEW.avatar_url);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile image cleanup
DROP TRIGGER IF EXISTS on_profile_image_update ON profiles;
CREATE TRIGGER on_profile_image_update
  BEFORE UPDATE OF avatar_url ON profiles
  FOR EACH ROW
  WHEN (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
  EXECUTE FUNCTION handle_profile_image_cleanup();