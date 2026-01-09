-- Migration: Enhance org_call_types for coaching and workflow configuration
-- Purpose: Add enable_coaching flag and workflow_config JSONB for custom workflows
-- Date: 2025-12-13

-- =============================================================================
-- Add coaching and workflow configuration columns to org_call_types
-- =============================================================================

ALTER TABLE org_call_types
ADD COLUMN IF NOT EXISTS enable_coaching BOOLEAN DEFAULT true;

ALTER TABLE org_call_types
ADD COLUMN IF NOT EXISTS workflow_config JSONB DEFAULT '{}';

-- =============================================================================
-- Update defaults to disable coaching for internal/non-sales calls
-- =============================================================================

UPDATE org_call_types
SET enable_coaching = false
WHERE name IN ('Internal Stand Up', 'Scrum');

-- =============================================================================
-- Add default workflow configurations for sales call types
-- =============================================================================

-- Discovery call workflow
UPDATE org_call_types
SET workflow_config = jsonb_build_object(
  'checklist_items', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Asked about current process/pain points',
      'required', true,
      'category', 'discovery',
      'keywords', ARRAY['pain points', 'challenges', 'current process', 'how do you', 'tell me about']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Identified decision makers',
      'required', true,
      'category', 'discovery',
      'keywords', ARRAY['decision maker', 'who decides', 'approval', 'sign off', 'stakeholder']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Discussed budget/timeline',
      'required', true,
      'category', 'qualification',
      'keywords', ARRAY['budget', 'timeline', 'when', 'how soon', 'timeframe', 'spend']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Uncovered success criteria',
      'required', false,
      'category', 'discovery',
      'keywords', ARRAY['success', 'criteria', 'goals', 'objectives', 'measure', 'KPI']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Asked about competitors considered',
      'required', false,
      'category', 'competitive',
      'keywords', ARRAY['competitors', 'also looking', 'other options', 'alternatives', 'compared']
    )
  ),
  'notifications', jsonb_build_object(
    'on_missing_required', jsonb_build_object(
      'enabled', true,
      'channels', ARRAY['in_app'],
      'delay_minutes', 30
    )
  ),
  'automations', jsonb_build_object(
    'update_pipeline_on_forward_movement', true,
    'create_follow_up_task', true
  )
)
WHERE name = 'Discovery';

-- Demo call workflow
UPDATE org_call_types
SET workflow_config = jsonb_build_object(
  'checklist_items', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Confirmed attendees and roles',
      'required', true,
      'category', 'preparation',
      'keywords', ARRAY['who is joining', 'attendees', 'introduce', 'role', 'team members']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Tailored demo to stated pain points',
      'required', true,
      'category', 'presentation',
      'keywords', ARRAY['you mentioned', 'your challenge', 'specifically for you', 'your use case']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Asked for feedback during demo',
      'required', true,
      'category', 'engagement',
      'keywords', ARRAY['what do you think', 'make sense', 'questions', 'feedback', 'thoughts']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Addressed questions/objections',
      'required', false,
      'category', 'objection_handling',
      'keywords', ARRAY['concern', 'question about', 'how does', 'what about', 'worried']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Established clear next steps',
      'required', true,
      'category', 'next_steps',
      'keywords', ARRAY['next steps', 'schedule', 'follow up', 'send over', 'proposal']
    )
  ),
  'notifications', jsonb_build_object(
    'on_missing_required', jsonb_build_object(
      'enabled', true,
      'channels', ARRAY['in_app'],
      'delay_minutes', 30
    )
  ),
  'automations', jsonb_build_object(
    'update_pipeline_on_forward_movement', true,
    'create_follow_up_task', true
  )
)
WHERE name = 'Demo';

-- Close call workflow
UPDATE org_call_types
SET workflow_config = jsonb_build_object(
  'checklist_items', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Final objection handling',
      'required', true,
      'category', 'objection_handling',
      'keywords', ARRAY['concerns', 'objection', 'hesitation', 'worry', 'issue']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Contract terms confirmed',
      'required', true,
      'category', 'closing',
      'keywords', ARRAY['contract', 'terms', 'agreement', 'pricing', 'sign']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Implementation timeline set',
      'required', true,
      'category', 'onboarding',
      'keywords', ARRAY['implementation', 'start date', 'onboarding', 'go live', 'launch']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Stakeholder sign-off confirmed',
      'required', true,
      'category', 'closing',
      'keywords', ARRAY['approval', 'sign off', 'approved', 'green light', 'authorize']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Onboarding next steps defined',
      'required', false,
      'category', 'onboarding',
      'keywords', ARRAY['onboarding', 'training', 'kickoff', 'next steps', 'setup']
    )
  ),
  'notifications', jsonb_build_object(
    'on_missing_required', jsonb_build_object(
      'enabled', true,
      'channels', ARRAY['in_app', 'email'],
      'delay_minutes', 15
    )
  ),
  'automations', jsonb_build_object(
    'update_pipeline_on_forward_movement', true,
    'create_follow_up_task', true
  )
)
WHERE name = 'Close';

-- Client call workflow (check-in focused)
UPDATE org_call_types
SET workflow_config = jsonb_build_object(
  'checklist_items', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Checked satisfaction with product/service',
      'required', true,
      'category', 'relationship',
      'keywords', ARRAY['happy', 'satisfied', 'how is', 'going well', 'working for you']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Identified upsell/expansion opportunities',
      'required', false,
      'category', 'expansion',
      'keywords', ARRAY['additional', 'more', 'expand', 'grow', 'other teams', 'departments']
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'Asked for referrals',
      'required', false,
      'category', 'referral',
      'keywords', ARRAY['referral', 'recommend', 'know anyone', 'colleague', 'introduction']
    )
  ),
  'notifications', jsonb_build_object(
    'on_missing_required', jsonb_build_object(
      'enabled', false,
      'channels', ARRAY['in_app'],
      'delay_minutes', 60
    )
  ),
  'automations', jsonb_build_object(
    'update_pipeline_on_forward_movement', false,
    'create_follow_up_task', true
  )
)
WHERE name = 'Client';

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON COLUMN org_call_types.enable_coaching IS 'Whether to generate coaching scorecards for this call type. Set to false for internal meetings.';
COMMENT ON COLUMN org_call_types.workflow_config IS 'Custom workflow configuration including checklist_items, notifications, and automations settings.';

-- =============================================================================
-- Grant permissions
-- =============================================================================

-- Ensure service role can access these columns
GRANT SELECT, UPDATE ON org_call_types TO service_role;
