-- Create storage bucket for meeting assets (thumbnails, etc)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-assets', 'meeting-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
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

-- Add comment
COMMENT ON TABLE storage.buckets IS 'meeting-assets bucket stores video thumbnails and other meeting-related media';
