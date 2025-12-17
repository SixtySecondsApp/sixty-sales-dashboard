CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roadmap suggestions table
CREATE TABLE IF NOT EXISTS roadmap_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feature', 'bug', 'improvement', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'in_progress', 'testing', 'completed', 'rejected')),
  
  -- User who submitted the suggestion
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Admin who is handling the suggestion
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  votes_count INTEGER DEFAULT 0,
  estimated_effort TEXT CHECK (estimated_effort IN ('small', 'medium', 'large', 'extra_large')),
  target_version TEXT,
  completion_date TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table for users to vote on suggestions
CREATE TABLE IF NOT EXISTS roadmap_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggestion_id UUID NOT NULL REFERENCES roadmap_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one vote per user per suggestion
  UNIQUE(suggestion_id, user_id)
);

-- Create comments table for discussions on suggestions
CREATE TABLE IF NOT EXISTS roadmap_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggestion_id UUID NOT NULL REFERENCES roadmap_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_admin_comment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS roadmap_suggestions_status_idx ON roadmap_suggestions(status);
CREATE INDEX IF NOT EXISTS roadmap_suggestions_type_idx ON roadmap_suggestions(type);
CREATE INDEX IF NOT EXISTS roadmap_suggestions_priority_idx ON roadmap_suggestions(priority);
CREATE INDEX IF NOT EXISTS roadmap_suggestions_submitted_by_idx ON roadmap_suggestions(submitted_by);
CREATE INDEX IF NOT EXISTS roadmap_suggestions_assigned_to_idx ON roadmap_suggestions(assigned_to);
CREATE INDEX IF NOT EXISTS roadmap_suggestions_created_at_idx ON roadmap_suggestions(created_at DESC);

CREATE INDEX IF NOT EXISTS roadmap_votes_suggestion_id_idx ON roadmap_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS roadmap_votes_user_id_idx ON roadmap_votes(user_id);

CREATE INDEX IF NOT EXISTS roadmap_comments_suggestion_id_idx ON roadmap_comments(suggestion_id);
CREATE INDEX IF NOT EXISTS roadmap_comments_created_at_idx ON roadmap_comments(created_at DESC);

-- Enable RLS
ALTER TABLE roadmap_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roadmap_suggestions
-- Everyone can view suggestions
CREATE POLICY "Everyone can view roadmap suggestions" ON roadmap_suggestions
  FOR SELECT
  USING (true);

-- Users can create suggestions
CREATE POLICY "Users can create roadmap suggestions" ON roadmap_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- Admins can update any suggestion
CREATE POLICY "Admins can update any roadmap suggestion" ON roadmap_suggestions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can delete suggestions
CREATE POLICY "Admins can delete roadmap suggestions" ON roadmap_suggestions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for roadmap_votes
-- Everyone can view votes
CREATE POLICY "Everyone can view roadmap votes" ON roadmap_votes
  FOR SELECT
  USING (true);

-- Users can create votes
CREATE POLICY "Users can create roadmap votes" ON roadmap_votes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes" ON roadmap_votes
  FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for roadmap_comments
-- Everyone can view comments
CREATE POLICY "Everyone can view roadmap comments" ON roadmap_comments
  FOR SELECT
  USING (true);

-- Users can create comments
CREATE POLICY "Users can create roadmap comments" ON roadmap_comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON roadmap_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON roadmap_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins can update/delete any comment
CREATE POLICY "Admins can manage any roadmap comment" ON roadmap_comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Function to update votes count when votes are added/removed
-- Uses atomic updates to prevent race conditions and negative counts
CREATE OR REPLACE FUNCTION update_suggestion_votes_count()
RETURNS TRIGGER AS $$
DECLARE
  suggestion_id_to_update UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    suggestion_id_to_update := NEW.suggestion_id;
  ELSIF TG_OP = 'DELETE' THEN
    suggestion_id_to_update := OLD.suggestion_id;
  ELSE
    RETURN NULL;
  END IF;

  -- Atomically recompute votes_count from actual vote records
  UPDATE roadmap_suggestions 
  SET votes_count = (
    SELECT COUNT(*)
    FROM roadmap_votes 
    WHERE suggestion_id = suggestion_id_to_update
  ),
  updated_at = NOW()
  WHERE id = suggestion_id_to_update;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  ELSE
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update votes count
DROP TRIGGER IF EXISTS update_suggestion_votes_count_trigger ON roadmap_votes;
CREATE TRIGGER update_suggestion_votes_count_trigger
  AFTER INSERT OR DELETE ON roadmap_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_suggestion_votes_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_roadmap_suggestions_updated_at ON roadmap_suggestions;
CREATE TRIGGER update_roadmap_suggestions_updated_at
  BEFORE UPDATE ON roadmap_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roadmap_comments_updated_at ON roadmap_comments;
CREATE TRIGGER update_roadmap_comments_updated_at
  BEFORE UPDATE ON roadmap_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();