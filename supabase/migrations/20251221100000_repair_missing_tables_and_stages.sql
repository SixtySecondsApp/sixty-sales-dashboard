-- Repair Migration: Fix missing tables and pipeline stages
-- This migration repairs issues where migrations were marked applied but tables don't exist

-- ============================================
-- 1. Create user_automation_rules table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS user_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification')),
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_rule_name UNIQUE(user_id, rule_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_user_id ON user_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_trigger_type ON user_automation_rules(trigger_type) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own automation rules" ON user_automation_rules;
DROP POLICY IF EXISTS "Service role full access to automation rules" ON user_automation_rules;

-- Create RLS policies
CREATE POLICY "Users can manage their own automation rules" ON user_automation_rules
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Service role full access to automation rules" ON user_automation_rules
  FOR ALL USING (
    (SELECT current_setting('role', true)) = 'service_role'
    OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
  );

-- ============================================
-- 2. Update pipeline stages to 4-stage system
-- ============================================

-- First ensure the table exists with all columns
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  order_position INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_stages' AND column_name = 'is_final') THEN
    ALTER TABLE deal_stages ADD COLUMN is_final BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_stages' AND column_name = 'description') THEN
    ALTER TABLE deal_stages ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add default_probability column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_stages' AND column_name = 'default_probability') THEN
    ALTER TABLE deal_stages ADD COLUMN default_probability INTEGER DEFAULT 20;
  END IF;
END $$;

-- Insert the 4-stage pipeline (don't delete old stages due to FK constraints)
INSERT INTO deal_stages (name, color, order_position, description, is_final, default_probability) VALUES
  ('SQL', '#6366F1', 1, 'Sales Qualified Lead - Initial contact and qualification', false, 20),
  ('Opportunity', '#3B82F6', 2, 'Proposal stage with confirmation modal workflow', false, 40),
  ('Verbal', '#F59E0B', 3, 'Terms agreed verbally, pending contract', false, 70),
  ('Signed', '#10B981', 4, 'Contract executed', true, 100)
ON CONFLICT (name) DO UPDATE SET
  color = EXCLUDED.color,
  order_position = EXCLUDED.order_position,
  description = EXCLUDED.description,
  is_final = EXCLUDED.is_final,
  default_probability = EXCLUDED.default_probability;

-- ============================================
-- 3. Disable problematic automation triggers
-- ============================================
DROP TRIGGER IF EXISTS trigger_unified_automation_activities ON activities;
DROP TRIGGER IF EXISTS trigger_unified_automation_deals ON deals;

-- Note: Tasks table doesn't exist in this database, skipping tasks RLS fixes
-- Note: Contacts RLS will be handled separately if needed
