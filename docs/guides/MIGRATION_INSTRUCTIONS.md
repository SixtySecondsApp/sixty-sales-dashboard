# Migration Instructions for Split Activities

## To apply the split activities migration:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the following SQL:

```sql
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
```

4. Click "Run" to execute the migration

## Step 2: Apply RLS Policies for Deal Splits

After running the first migration, also run this SQL to set up proper permissions:

```sql
-- Enable RLS on deal_splits table if not already enabled
ALTER TABLE deal_splits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can create deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can update own deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Only admins can delete deal splits" ON deal_splits;

-- Policy: All authenticated users can view deal splits
CREATE POLICY "Users can view all deal splits"
  ON deal_splits FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can create deal splits
CREATE POLICY "Users can create deal splits"
  ON deal_splits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own splits or if they're an admin
CREATE POLICY "Users can update deal splits"
  ON deal_splits FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Policy: Only admins can delete deal splits
CREATE POLICY "Only admins can delete deal splits"
  ON deal_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );
```

## What this migration does:

- Adds three new columns to the activities table to track split activities
- Creates indexes for better query performance
- Adds documentation comments to the columns

## Features enabled by this migration:

1. When a deal is split between multiple users, each user gets their own activity record
2. Split activities show the percentage and amount for each user
3. Revenue tracking accurately reflects each user's portion of split deals
4. The original activity is updated to show it has been split

## Permission System:

- **Any user** can create deal splits with other users
- **Any user** can edit split percentages
- **Only admins** can remove/delete deal splits
- This prevents accidental or malicious removal of split deals by non-admin users

## Testing the feature:

1. Find a deal with an associated sale activity
2. Click on the deal to open it
3. Click "Split Deal" to add other users
4. Add a user and set their percentage
5. Check both users' activity feeds - each should see their portion of the revenue