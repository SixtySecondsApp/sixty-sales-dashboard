-- Update focus model to use Claude 4.5 Haiku instead of 3.5 Haiku
-- Claude 4.5 Haiku has better rate limits and performance

UPDATE system_config
SET value = 'anthropic/claude-haiku-4.5',
    updated_at = NOW()
WHERE key = 'proposal_focus_model'
  AND value = 'anthropic/claude-3-5-haiku-20241022';

-- Also update if it's set to any other old Haiku version
UPDATE system_config
SET value = 'anthropic/claude-haiku-4.5',
    updated_at = NOW()
WHERE key = 'proposal_focus_model'
  AND value LIKE '%haiku%'
  AND value != 'anthropic/claude-haiku-4.5';


