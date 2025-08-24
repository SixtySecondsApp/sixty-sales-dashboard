-- Add columns to track split activities
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS split_percentage DECIMAL(5,2);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_is_split ON activities(is_split);
CREATE INDEX IF NOT EXISTS idx_activities_original_activity_id ON activities(original_activity_id);

-- Add comment to explain the columns
COMMENT ON COLUMN activities.is_split IS 'Indicates if this activity is a split from another activity due to deal splitting';
COMMENT ON COLUMN activities.original_activity_id IS 'Reference to the original activity this was split from';
COMMENT ON COLUMN activities.split_percentage IS 'The percentage of the deal split assigned to this user';