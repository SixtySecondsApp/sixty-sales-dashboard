-- Migration: Create user_onboarding_progress table
-- Phase 1.3: Database Migration for onboarding progress tracking
-- Created: 2025-11-27

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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_id ON user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_step ON user_onboarding_progress(onboarding_step);

-- Enable RLS
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read/update their own onboarding progress
CREATE POLICY "Users can view their own onboarding progress"
  ON user_onboarding_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON user_onboarding_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON user_onboarding_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically create onboarding progress record for new users
CREATE OR REPLACE FUNCTION create_onboarding_progress_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_onboarding_progress (user_id, onboarding_step)
  VALUES (NEW.id, 'welcome')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create onboarding progress when user signs up
CREATE TRIGGER create_onboarding_progress_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_onboarding_progress_for_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_onboarding_progress_timestamp
  BEFORE UPDATE ON user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_progress_updated_at();

-- Add comment
COMMENT ON TABLE user_onboarding_progress IS 'Tracks user onboarding progress through the Meetings feature setup flow';

