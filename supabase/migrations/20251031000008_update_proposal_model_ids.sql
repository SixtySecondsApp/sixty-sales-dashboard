-- Update proposal model settings to use valid OpenRouter model IDs
-- Fixes invalid model IDs that were using non-existent model names

UPDATE system_config
SET value = 'anthropic/claude-3-5-sonnet-20241022',
    updated_at = NOW()
WHERE key = 'proposal_sow_model' 
  AND value = 'anthropic/claude-sonnet-4-5-20250929';

UPDATE system_config
SET value = 'anthropic/claude-3-5-sonnet-20241022',
    updated_at = NOW()
WHERE key = 'proposal_proposal_model' 
  AND value = 'anthropic/claude-sonnet-4-5-20250929';

UPDATE system_config
SET value = 'anthropic/claude-3-5-haiku-20241022',
    updated_at = NOW()
WHERE key = 'proposal_focus_model' 
  AND value = 'anthropic/claude-haiku-4-20250514';

UPDATE system_config
SET value = 'anthropic/claude-3-5-sonnet-20241022',
    updated_at = NOW()
WHERE key = 'proposal_goals_model' 
  AND value = 'anthropic/claude-sonnet-4-5-20250929';


