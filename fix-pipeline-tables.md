# Fix Pipeline Automation Tables

## Issue
The application is showing 404 errors for `pipeline_automation_rules` and `pipeline_automation_executions` tables because they haven't been created in your Supabase database.

## Solution
Run the following SQL in your Supabase Dashboard SQL Editor:

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql/new
2. Copy and paste this SQL:

```sql
-- Fix pipeline automation tables and deal_stages population

-- 1. Ensure deal_stages table has data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM deal_stages LIMIT 1) THEN
    INSERT INTO deal_stages (name, color, order_position, description, default_probability) VALUES
      ('SQL', '#3B82F6', 10, 'Sales Qualified Lead', 20),
      ('Opportunity', '#F59E0B', 20, 'Active opportunity', 40),
      ('Verbal', '#8B5CF6', 30, 'Verbal agreement', 70),
      ('Signed', '#10B981', 40, 'Deal signed', 100)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- 2. Create pipeline_automation_rules table
CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  from_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,
  to_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  activity_type TEXT,
  activity_title TEXT,
  activity_details TEXT,
  activity_amount_source TEXT DEFAULT 'none',
  activity_fixed_amount DECIMAL(10,2),
  task_title TEXT,
  task_description TEXT,
  task_type TEXT DEFAULT 'follow_up',
  task_priority TEXT DEFAULT 'medium',
  task_days_after INTEGER DEFAULT 0,
  update_field_name TEXT,
  update_field_value TEXT,
  notification_message TEXT,
  notification_type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create pipeline_automation_executions table
CREATE TABLE IF NOT EXISTS pipeline_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES pipeline_automation_rules(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES deal_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES deal_stages(id) ON DELETE SET NULL,
  execution_status TEXT NOT NULL DEFAULT 'success',
  execution_details JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. Enable RLS
ALTER TABLE pipeline_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_automation_executions ENABLE ROW LEVEL SECURITY;

-- 5. Create basic RLS policies
DO $$
BEGIN
  -- Allow all authenticated users to view rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pipeline_automation_rules' 
    AND policyname = 'Allow authenticated users to view rules'
  ) THEN
    CREATE POLICY "Allow authenticated users to view rules" ON pipeline_automation_rules
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  
  -- Allow all authenticated users to view executions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pipeline_automation_executions' 
    AND policyname = 'Allow authenticated users to view executions'
  ) THEN
    CREATE POLICY "Allow authenticated users to view executions" ON pipeline_automation_executions
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  -- Allow admins to manage rules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pipeline_automation_rules' 
    AND policyname = 'Admins can manage rules'
  ) THEN
    CREATE POLICY "Admins can manage rules" ON pipeline_automation_rules
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_from_to_stage 
  ON pipeline_automation_rules(from_stage_id, to_stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_active 
  ON pipeline_automation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_deal_id 
  ON pipeline_automation_executions(deal_id);
```

3. Click "Run" to execute the SQL

## Verification
After running the SQL, refresh your application. The 404 errors should be resolved and the Automations page should load properly.

## Alternative: Quick Disable
If you want to temporarily disable the automation features instead of creating the tables, you can comment out the automation-related code in:
- `/src/pages/Automations.tsx`
- `/src/components/automation/AutomationRuleBuilder.tsx`

But it's recommended to create the tables to fully enable the feature.