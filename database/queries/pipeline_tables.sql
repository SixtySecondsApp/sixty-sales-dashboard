-- Pipeline stages table
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  default_probability INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  value DECIMAL(12,2) NOT NULL,
  description TEXT,
  stage_id UUID REFERENCES deal_stages(id) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  expected_close_date DATE,
  probability INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal activities table
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type TEXT NOT NULL,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal stage history table (for time tracking)
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES deal_stages(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- Add RLS policies
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
CREATE POLICY "Users can view their own deals" ON deals FOR SELECT USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
CREATE POLICY "Users can insert their own deals" ON deals FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
CREATE POLICY "Users can update their own deals" ON deals FOR UPDATE USING (owner_id = auth.uid());

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;
CREATE POLICY "Users can view their deal activities" ON deal_activities FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert deal activities" ON deal_activities;
CREATE POLICY "Users can insert deal activities" ON deal_activities FOR INSERT WITH CHECK (
  user_id = auth.uid() AND 
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their deal stage history" ON deal_stage_history;
CREATE POLICY "Users can view their deal stage history" ON deal_stage_history FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Insert default stages
INSERT INTO deal_stages (name, description, color, order_position, default_probability)
VALUES 
  ('Lead', 'New potential opportunity', '#3B82F6', 10, 10),
  ('Qualified', 'Qualified opportunity', '#8B5CF6', 20, 25),
  ('Proposal', 'Proposal sent', '#EAB308', 30, 50),
  ('Negotiation', 'In negotiation', '#F97316', 40, 75),
  ('Closed Won', 'Deal won', '#10B981', 50, 100),
  ('Closed Lost', 'Deal lost', '#EF4444', 60, 0)
ON CONFLICT (id) DO NOTHING; 