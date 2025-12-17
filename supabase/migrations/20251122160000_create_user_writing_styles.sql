-- Create user_writing_styles table for AI personalization
CREATE TABLE IF NOT EXISTS user_writing_styles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone_description TEXT NOT NULL,
  examples TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_writing_styles_user_id ON user_writing_styles(user_id);

-- RLS
ALTER TABLE user_writing_styles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own writing styles" ON user_writing_styles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own writing styles" ON user_writing_styles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own writing styles" ON user_writing_styles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own writing styles" ON user_writing_styles
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_writing_styles_updated_at
  BEFORE UPDATE ON user_writing_styles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();































