-- Phase 2: Unified AI Settings
-- Create user_ai_feature_settings table for per-feature model configuration

CREATE TABLE IF NOT EXISTS user_ai_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL, -- 'meeting_task_extraction', 'meeting_sentiment', 'proposal_generation', etc.
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openrouter', 'gemini')),
  model TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 2048 CHECK (max_tokens > 0),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_ai_feature_settings_user_id ON user_ai_feature_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_feature_settings_feature_key ON user_ai_feature_settings(feature_key);

-- Enable RLS
ALTER TABLE user_ai_feature_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own settings
CREATE POLICY "Users can view their own AI feature settings"
  ON user_ai_feature_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI feature settings"
  ON user_ai_feature_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI feature settings"
  ON user_ai_feature_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI feature settings"
  ON user_ai_feature_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_ai_feature_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_ai_feature_settings_timestamp
  BEFORE UPDATE ON user_ai_feature_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_feature_settings_updated_at();

-- Insert default feature model configurations into system_config
-- These are fallback defaults if user hasn't configured their own settings
INSERT INTO system_config (key, value, description) VALUES
  ('ai_meeting_task_model', 'anthropic/claude-haiku-4-5-20250514', 'Default task extraction model'),
  ('ai_meeting_sentiment_model', 'anthropic/claude-haiku-4-5-20250514', 'Default sentiment analysis model'),
  ('ai_proposal_model', 'anthropic/claude-3-5-sonnet-20241022', 'Default proposal generation model'),
  ('ai_meeting_summary_model', 'anthropic/claude-haiku-4-5-20250514', 'Default meeting summary model')
ON CONFLICT (key) DO NOTHING;

-- Helper function to get user's model config for a feature
CREATE OR REPLACE FUNCTION get_user_feature_model_config(
  p_user_id UUID,
  p_feature_key TEXT
)
RETURNS TABLE (
  provider TEXT,
  model TEXT,
  temperature NUMERIC,
  max_tokens INTEGER,
  is_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uafs.provider,
    uafs.model,
    uafs.temperature,
    uafs.max_tokens,
    uafs.is_enabled
  FROM user_ai_feature_settings uafs
  WHERE uafs.user_id = p_user_id
    AND uafs.feature_key = p_feature_key
    AND uafs.is_enabled = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_feature_model_config TO authenticated, service_role;

-- Add comment
COMMENT ON TABLE user_ai_feature_settings IS 'User-specific AI model configuration per feature (task extraction, sentiment, proposals, etc.)';
COMMENT ON FUNCTION get_user_feature_model_config IS 'Get user-specific model configuration for a feature, returns empty if not configured';

