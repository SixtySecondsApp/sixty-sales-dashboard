-- Add avatar_url column to activities table
ALTER TABLE activities DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE activities ADD COLUMN avatar_url TEXT;

-- Update existing activities with avatar_url from profiles
UPDATE activities a
SET avatar_url = p.avatar_url
FROM profiles p
WHERE a.user_id = p.id; 