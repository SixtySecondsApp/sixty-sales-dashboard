-- Create user_settings table for API key storage if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_provider_keys JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id)
);

-- Create AI usage logs table for tracking and billing
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID, -- References user_automation_rules(id), but made optional to avoid dependency ordering issues
  provider VARCHAR(50),
  model VARCHAR(100),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_estimate DECIMAL(10, 6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_workflow_id ON ai_usage_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_settings (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for ai_usage_logs (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can view own usage logs" ON ai_usage_logs;
CREATE POLICY "Users can view own usage logs" ON ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage logs" ON ai_usage_logs;
CREATE POLICY "Users can insert own usage logs" ON ai_usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_settings updated_at (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add AI agent configuration to user_automation_rules table (for storing AI node configs)
-- Note: This ALTER is wrapped in a DO block to handle the case where the table doesn't exist yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_automation_rules') THEN
    ALTER TABLE user_automation_rules ADD COLUMN IF NOT EXISTS ai_agent_configs JSONB DEFAULT '[]';
  END IF;
END;
$$;

-- Create AI prompt templates table for reusable prompts
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  system_prompt TEXT,
  user_prompt TEXT,
  variables JSONB DEFAULT '[]',
  model_provider VARCHAR(50),
  model VARCHAR(100),
  temperature DECIMAL(2, 1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for prompt templates
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_user_id ON ai_prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_is_public ON ai_prompt_templates(is_public);

-- Enable RLS for prompt templates
ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_prompt_templates (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can view own templates" ON ai_prompt_templates;
CREATE POLICY "Users can view own templates" ON ai_prompt_templates
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create own templates" ON ai_prompt_templates;
CREATE POLICY "Users can create own templates" ON ai_prompt_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON ai_prompt_templates;
CREATE POLICY "Users can update own templates" ON ai_prompt_templates
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON ai_prompt_templates;
CREATE POLICY "Users can delete own templates" ON ai_prompt_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for ai_prompt_templates updated_at (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_ai_prompt_templates_updated_at ON ai_prompt_templates;
CREATE TRIGGER update_ai_prompt_templates_updated_at
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create function to calculate AI usage cost (basic estimation)
CREATE OR REPLACE FUNCTION calculate_ai_cost(
  p_provider VARCHAR,
  p_model VARCHAR,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER
) RETURNS DECIMAL(10, 6) AS $$
DECLARE
  v_cost DECIMAL(10, 6) := 0;
BEGIN
  -- Basic cost calculation (in USD)
  -- These are example rates and should be updated based on actual provider pricing
  IF p_provider = 'openai' THEN
    IF p_model LIKE 'gpt-4%' THEN
      v_cost := (p_prompt_tokens * 0.00003) + (p_completion_tokens * 0.00006);
    ELSIF p_model LIKE 'gpt-3.5%' THEN
      v_cost := (p_prompt_tokens * 0.0000005) + (p_completion_tokens * 0.0000015);
    END IF;
  ELSIF p_provider = 'anthropic' THEN
    IF p_model LIKE 'claude-3-opus%' THEN
      v_cost := (p_prompt_tokens * 0.000015) + (p_completion_tokens * 0.000075);
    ELSIF p_model LIKE 'claude-3-sonnet%' THEN
      v_cost := (p_prompt_tokens * 0.000003) + (p_completion_tokens * 0.000015);
    ELSIF p_model LIKE 'claude-3-haiku%' THEN
      v_cost := (p_prompt_tokens * 0.00000025) + (p_completion_tokens * 0.00000125);
    END IF;
  END IF;
  
  RETURN v_cost;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate cost when inserting usage logs
CREATE OR REPLACE FUNCTION auto_calculate_cost()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cost_estimate := calculate_ai_cost(
    NEW.provider,
    NEW.model,
    NEW.prompt_tokens,
    NEW.completion_tokens
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_ai_usage_cost ON ai_usage_logs;
CREATE TRIGGER calculate_ai_usage_cost
  BEFORE INSERT ON ai_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_cost();

-- Create view for monthly AI usage summary
CREATE OR REPLACE VIEW monthly_ai_usage AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  provider,
  model,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_estimate) as total_cost
FROM ai_usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at), provider, model
ORDER BY month DESC, user_id;

-- Grant appropriate permissions
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON ai_usage_logs TO authenticated;
GRANT ALL ON ai_prompt_templates TO authenticated;
GRANT SELECT ON monthly_ai_usage TO authenticated;