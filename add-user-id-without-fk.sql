-- Add user_id column to activities table WITHOUT foreign key constraint
-- This makes dev-v2 compatible with the frontend code

-- Add user_id column
ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID;

-- Copy owner_id to user_id
UPDATE activities SET user_id = owner_id WHERE user_id IS NULL;

-- Create index for better query performance (no foreign key yet)
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);

-- Verify
SELECT
    'activities columns check' as info,
    COUNT(*) as total_activities,
    COUNT(DISTINCT owner_id) as unique_owners,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN owner_id = user_id THEN 1 ELSE 0 END) as matching_ids
FROM activities;

SELECT 'Added user_id column successfully - now run remap-profile-ids-complete.sql' as next_step;
