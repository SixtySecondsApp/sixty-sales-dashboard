-- =====================================================
-- FIX: Create missing user_onboarding_progress table
-- =====================================================
-- The signup is failing because a trigger tries to insert into
-- user_onboarding_progress but the table doesn't exist.

-- First, drop the trigger if it exists (it references a non-existent table)
DROP TRIGGER IF EXISTS create_onboarding_progress_on_signup ON auth.users;
DROP FUNCTION IF EXISTS create_onboarding_progress_for_new_user();

-- Create the missing table
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_step TEXT DEFAULT 'welcome',
  onboarding_completed_at TIMESTAMPTZ,
  skipped_onboarding BOOLEAN DEFAULT false,
  fathom_connected BOOLEAN DEFAULT false,
  first_meeting_synced BOOLEAN DEFAULT false,
  first_proposal_generated BOOLEAN DEFAULT false,
  features_discovered JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_id ON user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_step ON user_onboarding_progress(onboarding_step);

-- Enable RLS
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON user_onboarding_progress;

CREATE POLICY "Users can view their own onboarding progress"
  ON user_onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON user_onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON user_onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service_role to insert (for triggers)
CREATE POLICY "Service role can insert onboarding progress"
  ON user_onboarding_progress FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Recreate the trigger function
CREATE OR REPLACE FUNCTION create_onboarding_progress_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_onboarding_progress (user_id, onboarding_step)
  VALUES (NEW.id, 'welcome')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create onboarding progress for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER create_onboarding_progress_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_onboarding_progress_for_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_onboarding_progress_for_new_user() TO service_role;

SELECT 'user_onboarding_progress table created!' as status;
