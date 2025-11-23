-- =====================================================
-- Seed Intervention Templates
-- =====================================================
-- Inserts default "permission to close" templates from the feature brief
-- These are system templates that all users can access

-- =====================================================
-- Master Template (Control Variant)
-- =====================================================

INSERT INTO intervention_templates (
  user_id, -- NULL for system templates
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - After Proposal',
  'permission_to_close',
  'after_proposal',
  'Re: {{company_name}} Proposal',
  E'Hey {{first_name}},\n\nI haven''t heard back from you since {{last_meaningful_interaction}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll close the file on this for now and we can {{reconnect_suggestion}}.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "company_name", "last_meaningful_interaction", "personalized_assumption", "reconnect_suggestion", "sender_name"], "last_meaningful_interaction": "you got the proposal", "personalized_assumption": "it wasn''t a fit or doesn''t fit into your current list of priorities", "reconnect_suggestion": "connect again when the time''s right"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Classic permission to close template for use after sending a proposal with no response',
  'Use this when you''ve sent a proposal and haven''t heard back after 7+ days. Works best when you''ve had meaningful discussions prior to sending the proposal.',
  'After 2-3 ignored follow-ups, 7-14 days after proposal sent',
  ARRAY['permission_to_close', 'proposal', 'ghosting', 'follow_up']
);

-- =====================================================
-- After Demo Template
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - After Demo',
  'permission_to_close',
  'after_demo',
  'Re: {{company_name}} Demo',
  E'Hey {{first_name}},\n\nI haven''t heard back since our call about {{demo_topic}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll close the file on this for now and we can reconnect when it makes more sense.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "company_name", "demo_topic", "personalized_assumption", "sender_name"], "demo_topic": "automating your outreach workflows", "personalized_assumption": "the technical integration concerns we discussed took precedence or this isn''t the right timing"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Permission to close after demo or product walkthrough with no response',
  'Use after a demo when prospect goes silent. Reference specific concerns or topics from the demo.',
  'After 2 ignored follow-ups, 5-10 days after demo',
  ARRAY['permission_to_close', 'demo', 'product_demo', 'ghosting']
);

-- =====================================================
-- After Meeting No-Show Template
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - Meeting Rescheduled',
  'permission_to_close',
  'meeting_rescheduled',
  'Re: Rescheduling Our Call',
  E'Hey {{first_name}},\n\nHaven''t been able to reconnect since we had to reschedule our {{meeting_type}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll take this off your plate for now - reach out when timing''s better.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "meeting_type", "personalized_assumption", "sender_name"], "meeting_type": "demo", "personalized_assumption": "the project isn''t a priority right now or something else came up"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Use when meeting was rescheduled multiple times without new date set',
  'Works when prospect cancels/reschedules 2+ times without providing new availability.',
  'After 2 reschedules without new date, 7+ days after last cancellation',
  ARRAY['permission_to_close', 'meeting', 'reschedule', 'no_show']
);

-- =====================================================
-- Multiple Follow-ups Ignored Template
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - Multiple Follow-ups Ignored',
  'permission_to_close',
  'multiple_followups_ignored',
  'Re: {{topic}}',
  E'Hey {{first_name}},\n\nI haven''t heard back since I sent over {{last_item_sent}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll close the file on this for now and we can connect again when the stars align.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "topic", "last_item_sent", "personalized_assumption", "sender_name"], "last_item_sent": "the case studies you asked for", "personalized_assumption": "the budget conversation with your team didn''t go the way you hoped or priorities shifted"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Use when prospect requested information then went silent after you sent it',
  'Effective when you sent requested materials and they''ve ignored 2+ follow-ups.',
  'After 2-3 ignored follow-ups, 7-14 days after sending materials',
  ARRAY['permission_to_close', 'follow_up', 'ghosting', 'materials_sent']
);

-- =====================================================
-- After Technical Questions Template
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - Technical Questions Unanswered',
  'permission_to_close',
  'after_technical_questions',
  'Re: {{technical_topic}}',
  E'Hey {{first_name}},\n\nHaven''t heard back since I answered your questions about {{technical_topic}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll close the file on this for now - happy to reconnect when {{specific_condition}}.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "technical_topic", "personalized_assumption", "specific_condition", "sender_name"], "technical_topic": "our API integration", "personalized_assumption": "the engineering bandwidth concerns you mentioned are still blockers or this got pushed to next quarter", "specific_condition": "capacity opens up"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Use when you answered technical questions but prospect went silent',
  'Works when technical discussions stall. Reference specific concerns from their questions.',
  'After 1-2 ignored follow-ups, 7-10 days after answering questions',
  ARRAY['permission_to_close', 'technical', 'integration', 'engineering']
);

-- =====================================================
-- Champion Went Quiet Template
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - Champion Quiet',
  'permission_to_close',
  'champion_quiet',
  'Re: {{initiative}}',
  E'Hey {{first_name}},\n\nI haven''t heard from you since our last check-in about {{initiative}}.\n\nI''m guessing {{personalized_assumption}}.\n\nI''ll take this off your radar for now - let me know if circumstances change.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "initiative", "personalized_assumption", "sender_name"], "initiative": "getting the leadership team aligned", "personalized_assumption": "internal priorities shifted or you didn''t get the buy-in you were hoping for"}'::jsonb,
  TRUE,
  'control',
  TRUE,
  TRUE,
  'Use when your internal champion stops responding',
  'Effective when someone who was actively championing your solution goes dark.',
  'After 2 ignored check-ins, 10-14 days since last contact',
  ARRAY['permission_to_close', 'champion', 'internal_blockers', 'politics']
);

-- =====================================================
-- A/B Test Variant A: More Specific
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  parent_template_id,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - More Specific (Variant A)',
  'permission_to_close',
  'general_ghosting',
  'Re: {{topic}}',
  E'Hey {{first_name}},\n\nI haven''t heard back from you since {{last_meaningful_interaction}}.\n\nI''m guessing {{specific_concern}} is still a blocker or the timing just isn''t right.\n\nI''ll close the file on this for now and we can reconnect when it makes sense.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "topic", "last_meaningful_interaction", "specific_concern", "sender_name"], "specific_concern": "the budget concerns we discussed"}'::jsonb,
  FALSE,
  'more_specific',
  (SELECT id FROM intervention_templates WHERE template_name = 'Permission to Close - After Proposal' LIMIT 1),
  TRUE,
  TRUE,
  'A/B test variant that references specific concerns from conversations',
  'More specific than control. Reference exact concerns or objections raised.',
  'After 2-3 ignored follow-ups',
  ARRAY['permission_to_close', 'ab_test', 'variant_a', 'specific']
);

-- =====================================================
-- A/B Test Variant B: More Vulnerable
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  parent_template_id,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - More Vulnerable (Variant B)',
  'permission_to_close',
  'general_ghosting',
  'Re: {{topic}}',
  E'Hey {{first_name}},\n\nI haven''t heard back from you since {{last_meaningful_interaction}}.\n\nI''m guessing I missed the mark on what you''re actually trying to solve or this isn''t a priority right now.\n\nI''ll close the file on this for now and we can reconnect if things change.\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "topic", "last_meaningful_interaction", "sender_name"]}'::jsonb,
  FALSE,
  'more_vulnerable',
  (SELECT id FROM intervention_templates WHERE template_name = 'Permission to Close - After Proposal' LIMIT 1),
  TRUE,
  TRUE,
  'A/B test variant with more vulnerable, self-aware positioning',
  'Takes ownership for potentially missing the mark. More vulnerable approach.',
  'After 2-3 ignored follow-ups',
  ARRAY['permission_to_close', 'ab_test', 'variant_b', 'vulnerable']
);

-- =====================================================
-- A/B Test Variant C: Question Format
-- =====================================================

INSERT INTO intervention_templates (
  user_id,
  template_name,
  template_type,
  context_trigger,
  subject_line,
  template_body,
  personalization_fields,
  is_control_variant,
  variant_name,
  parent_template_id,
  is_active,
  is_system_template,
  description,
  usage_notes,
  recommended_timing,
  tags
) VALUES (
  NULL,
  'Permission to Close - Question Format (Variant C)',
  'permission_to_close',
  'general_ghosting',
  'Re: {{topic}}',
  E'Hey {{first_name}},\n\nI haven''t heard back since {{last_meaningful_interaction}}.\n\nShould I take this off your radar for now, or is there something else I can do to help move this forward?\n\nAll the best,\n{{sender_name}}',
  '{"fields": ["first_name", "topic", "last_meaningful_interaction", "sender_name"]}'::jsonb,
  FALSE,
  'question_format',
  (SELECT id FROM intervention_templates WHERE template_name = 'Permission to Close - After Proposal' LIMIT 1),
  TRUE,
  TRUE,
  'A/B test variant using a question format for decision forcing',
  'Uses question to force a decision without applying pressure.',
  'After 2-3 ignored follow-ups',
  ARRAY['permission_to_close', 'ab_test', 'variant_c', 'question']
);

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN intervention_templates.parent_template_id IS 'Links A/B test variants to their parent control template';
