import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log('================================');
console.log('WORKFLOW TABLE FIX');
console.log('================================\n');
console.log('The Supabase schema cache is out of sync.');
console.log('\nPlease follow these steps:\n');
console.log('1. Go to your Supabase Dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Run the following SQL:\n');
console.log('================================\n');

const sql = `
-- Drop the existing table if it exists
DROP TABLE IF EXISTS public.user_automation_rules CASCADE;

-- Create the table with all necessary columns
CREATE TABLE public.user_automation_rules (
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

-- Add indexes
CREATE INDEX idx_user_automation_rules_user_id ON public.user_automation_rules(user_id);
CREATE INDEX idx_user_automation_rules_is_active ON public.user_automation_rules(is_active);
CREATE INDEX idx_user_automation_rules_trigger_type ON public.user_automation_rules(trigger_type);

-- Enable RLS
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own automation rules" ON public.user_automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules" ON public.user_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules" ON public.user_automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules" ON public.user_automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_automation_rules TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
`;

console.log(sql);
console.log('\n================================');
console.log('4. After running the SQL, refresh your browser');
console.log('5. Try saving a workflow again');
console.log('================================\n');