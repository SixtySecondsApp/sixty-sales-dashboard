-- Create deal_stages table directly
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

-- Insert default deal stages
INSERT INTO deal_stages (name, color, order_position, description, is_final) VALUES
  ('Lead', '#6366F1', 1, 'Initial lead qualification', false),
  ('Qualified', '#3B82F6', 2, 'Qualified opportunity', false),
  ('Proposal', '#F59E0B', 3, 'Proposal submitted', false),
  ('Negotiation', '#EF4444', 4, 'Terms negotiation', false),
  ('Closed Won', '#10B981', 5, 'Deal won', true),
  ('Closed Lost', '#6B7280', 6, 'Deal lost', true)
ON CONFLICT (name) DO NOTHING;

-- Show created stages
SELECT 'Created deal stages:' as info;
SELECT id, name, color, order_position FROM deal_stages ORDER BY order_position;