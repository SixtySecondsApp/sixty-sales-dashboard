-- Add proposal model settings to system_config table
-- This allows users to configure which models to use for SOW and Proposal generation via OpenRouter

-- Add model settings to system_config (using existing table)
INSERT INTO system_config (key, value, description)
VALUES
  ('proposal_sow_model', 'anthropic/claude-3-5-sonnet-20241022', 'OpenRouter model ID for SOW generation'),
  ('proposal_proposal_model', 'anthropic/claude-3-5-sonnet-20241022', 'OpenRouter model ID for Proposal generation'),
  ('proposal_focus_model', 'anthropic/claude-3-5-haiku-20241022', 'OpenRouter model ID for focus area analysis'),
  ('proposal_goals_model', 'anthropic/claude-3-5-sonnet-20241022', 'OpenRouter model ID for goals generation')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add comment
COMMENT ON TABLE system_config IS 'System configuration including proposal generation model settings';

