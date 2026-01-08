-- Pipeline stages table
CREATE TABLE deal_stages (
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
CREATE TABLE deals (
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
CREATE TABLE deal_activities (
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
CREATE TABLE deal_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES deal_stages(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- Add RLS policies for security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own deals" ON deals FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own deals" ON deals FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own deals" ON deals FOR UPDATE USING (owner_id = auth.uid());

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their deal activities" ON deal_activities FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);
CREATE POLICY "Users can insert deal activities" ON deal_activities FOR INSERT WITH CHECK (
  user_id = auth.uid() AND 
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their deal stage history" ON deal_stage_history FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
); 