-- Fix deal_stages RLS policies
-- RLS was enabled but no policies existed, preventing users from reading pipeline stages

-- Allow all authenticated users to read pipeline stages (reference data)
CREATE POLICY IF NOT EXISTS "deal_stages_select_authenticated" ON deal_stages
  FOR SELECT
  USING (true);

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "deal_stages_service_role_all" ON deal_stages
  FOR ALL
  USING (current_setting('role', true) = 'service_role');
