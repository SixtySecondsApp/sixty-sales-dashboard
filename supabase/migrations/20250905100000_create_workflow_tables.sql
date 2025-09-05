-- Create user_automation_rules table for workflow storage
CREATE TABLE IF NOT EXISTS public.user_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  canvas_data JSONB,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  template_id TEXT,
  is_active BOOLEAN DEFAULT false,
  priority_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_user_id ON public.user_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_is_active ON public.user_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_trigger_type ON public.user_automation_rules(trigger_type);

-- Enable Row Level Security
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own rules
CREATE POLICY "Users can view own automation rules" ON public.user_automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rules
CREATE POLICY "Users can create own automation rules" ON public.user_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rules
CREATE POLICY "Users can update own automation rules" ON public.user_automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own rules
CREATE POLICY "Users can delete own automation rules" ON public.user_automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_automation_rules_updated_at 
  BEFORE UPDATE ON public.user_automation_rules 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_automation_rules TO authenticated;
GRANT USAGE ON SEQUENCE user_automation_rules_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE public.user_automation_rules IS 'Stores user-created workflow automation rules';