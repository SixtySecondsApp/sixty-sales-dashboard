-- Fixed version of 20251025_create_meeting_assets_bucket.sql
-- This version uses proper Supabase storage bucket creation

-- NOTE: Storage buckets CANNOT be created via SQL migrations
-- They must be created through the Supabase Dashboard

-- Instead, this migration only sets up the RLS policies
-- You must manually create the bucket first via Dashboard

-- ==============================================================================
-- MANUAL STEP REQUIRED:
-- ==============================================================================
-- 1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/storage/buckets
-- 2. Click "New Bucket"
-- 3. Name: meeting-assets
-- 4. Public: YES (check the box)
-- 5. Click "Create Bucket"
-- ==============================================================================

-- Then run this SQL to set up policies:

-- Check if bucket exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'meeting-assets'
  ) THEN
    -- Set up RLS policies for the bucket

    -- Drop existing policies if they exist (idempotent)
    DROP POLICY IF EXISTS "Public read access for meeting assets" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload meeting assets" ON storage.objects;
    DROP POLICY IF EXISTS "Service role can manage all meeting assets" ON storage.objects;

    -- Create new policies
    CREATE POLICY "Public read access for meeting assets"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'meeting-assets');

    CREATE POLICY "Authenticated users can upload meeting assets"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'meeting-assets');

    CREATE POLICY "Service role can manage all meeting assets"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'meeting-assets');

    RAISE NOTICE 'Storage policies created successfully for meeting-assets bucket';
  ELSE
    RAISE NOTICE 'Bucket "meeting-assets" does not exist yet. Please create it via Dashboard first.';
    RAISE NOTICE 'Go to: Storage → Buckets → New Bucket → Name: meeting-assets (Public: YES)';
  END IF;
END $$;
