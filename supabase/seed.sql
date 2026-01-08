-- Seed Data for Staging Environment
-- Generated: 2026-01-08
-- Source: Production database ygdpgliavpxeugaajgrb
--
-- IMPORTANT: This file seeds reference/configuration data only.
-- It does NOT include user data, organizations, or sensitive credentials.
-- Staging will use its own auth configuration and service keys.

BEGIN;

-- ============================================
-- Deal Stages (5 rows)
-- ============================================
INSERT INTO deal_stages (id, name, color, is_final, description, order_position, default_probability) VALUES
('5f17d356-75d9-4e92-a654-deb7587be28b', 'Lost', '#EF4444', false, 'Deal lost', 70, 0),
('603b5020-aafc-4646-9195-9f041a9a3f14', 'SQL', '#6366F1', false, 'Sales Qualified Lead - Initial contact and qualification', 1, 20),
('8be6a854-e7d0-41b5-9057-03b2213e7697', 'Opportunity', '#3B82F6', false, 'Proposal stage with confirmation modal workflow', 2, 40),
('e23859a1-50bd-45c0-8790-974d0aab00dd', 'Verbal', '#F59E0B', false, 'Terms agreed verbally, pending contract', 3, 70),
('207a94db-abd8-43d8-ba21-411be66183d2', 'Signed', '#10B981', true, 'Contract executed', 4, 100)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Stages (6 rows) - Alternative/legacy stages table
-- ============================================
INSERT INTO stages (id, name, position) VALUES
('ca502927-4f54-4623-bfb8-e616ab288bb3', 'Lead', 1),
('8867484b-715d-49b6-bc6b-a3b56ad53cd8', 'Qualified', 2),
('70fe03ee-9fc2-4dbd-bfa5-108df66d6e1f', 'Proposal', 3),
('38fef911-1a43-4f59-bb88-66ca05651c38', 'Negotiation', 4),
('88038eac-576f-42cd-81c0-8963be4aa939', 'Closed Won', 5),
('f0182ad7-6bea-47c0-86c4-6ad6200691eb', 'Closed Lost', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Pricing Plans (3 rows) - Legacy pricing
-- ============================================
INSERT INTO pricing_plans (id, name, price, features, interval, is_active, is_popular, description, order_index) VALUES
('8e46fa87-95a6-4731-9485-87645ecbf18e', 'Starter', 249.00, ARRAY['Up to 3 Users','500 Self-Serve AI Video Messages/month','Basic Self-Hosted Landing Page','Self-Serve AI VoiceOver','50 Video Credits/month','Standard Support'], 'month', true, false, 'Perfect for small teams testing video outreach', 1),
('918ef6c6-c97c-4e90-b449-056bf8392cfa', 'Growth', 999.00, ARRAY['Up to 10 Users','4000 AI Emails/month','2000 B2B Contacts/month','Custom Landing Page','Pro AI Voice Clone','200 Video Credits/month','Priority Support','CRM Integration','Daily Stats','Monthly Optimisation','Smart Follow-ups','Deliverability Setup and Management'], 'month', true, true, 'Ideal for SMEs scaling engagement and automation', 2),
('c9a0eb77-1cec-4159-a9b0-410a9d8f3992', 'Scale', 1699.00, ARRAY['Up to 50 Users','10000 AI Emails/month','5000 B2B Contacts/month','Custom Landing Page','Pro AI Voice Clone','500 Video Credits/month','Priority Support','CRM Integration','Live Stats','Weekly Optimisation','Smart Follow-ups','Managed Replies','Deliverability Setup and Management'], 'month', true, false, 'For high-volume multi-channel outreach', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Subscription Plans (4 rows) - Current pricing
-- ============================================
INSERT INTO subscription_plans (id, name, slug, cta_text, currency, features, is_active, is_public, max_users, badge_text, is_default, trial_days, description, is_free_tier, price_yearly, display_order, price_monthly, included_seats, max_storage_mb, per_seat_price, highlight_features, max_meetings_per_month, max_ai_tokens_per_month, meeting_retention_months) VALUES
('8e4faeb7-c5bd-43b9-9965-c04d03b5bbbf', 'Free', 'free', 'Get Started Free', 'USD', '{"analytics": true, "api_access": false, "team_insights": false, "custom_branding": false, "priority_support": false}'::jsonb, true, true, 1, NULL, true, 0, 'Get started with 30 free meetings', true, 0, 1, 0, 1, 100, 0, ARRAY['Up to 30 meetings','Basic analytics','1 month history','1 user'], 15, 10000, 1),
('4db17ac8-5856-4ae0-961b-f986d986a510', 'Pro', 'pro', 'Start Free Trial', 'USD', '{"analytics": true, "api_access": false, "team_insights": false, "custom_branding": false, "priority_support": false}'::jsonb, true, true, 1, 'Most Popular', false, 14, 'Unlimited everything for power users', false, 47000, 30, 4900, 1, 5000, 0, ARRAY['Unlimited meetings','Unlimited proposals','Unlimited retention','API access','Priority support'], NULL, 500000, NULL),
('6d4dcf53-8822-4a20-91d9-12ac4cd5e9c3', 'Team', 'team', 'Start Free Trial', 'GBP', '{"sso": true, "analytics": true, "api_access": true, "integrations": true, "team_insights": true, "custom_branding": false, "priority_support": true}'::jsonb, true, true, NULL, NULL, false, 14, 'Collaboration at scale - 2 seats included', false, 74900, 40, 7800, 2, NULL, 3900, ARRAY['2 seats included','Additional users available','Unlimited meetings','Unlimited retention','Team workspaces','Manager dashboard','SSO / SAML','Priority support'], NULL, NULL, NULL),
('4327053a-8123-4c53-b250-527c703b67e7', 'Enterprise', 'enterprise', 'Contact Sales', 'USD', '{"analytics": true, "api_access": true, "team_insights": true, "custom_branding": true, "priority_support": true}'::jsonb, true, true, NULL, NULL, false, 14, 'For large organizations with custom needs', false, 0, 4, 0, 1, NULL, 0, ARRAY['Everything in Team','Dedicated account manager','Custom integrations','SSO and advanced security','Onboarding and training','SLA guarantee'], NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Smart Task Templates (5 rows)
-- ============================================
INSERT INTO smart_task_templates (id, priority, is_active, task_type, task_title, task_description, days_after_trigger, trigger_activity_type) VALUES
('01a0f61d-9ab6-4a5a-aac1-1b6b6eae48f5', 'high', true, 'follow_up', 'Follow up on proposal', 'Check if the client has reviewed the proposal and answer any questions', 3, 'proposal'),
('3da57196-dc84-4328-9fe5-096500e2dbf4', 'medium', true, 'follow_up', 'Send meeting follow-up', 'Send thank you email and next steps from the meeting', 1, 'meeting'),
('40b59ad9-0568-43db-a4bf-0767ab0421d0', 'high', true, 'follow_up', 'Demo follow-up', 'Send demo recording and schedule next steps discussion', 1, 'demo'),
('57ace6b7-c0df-485e-9f0d-090166692569', 'medium', true, 'follow_up', 'Follow up on outreach', 'Check if prospect received initial outreach and gauge interest', 2, 'outbound'),
('e0e82e11-7201-42c4-8531-8ffae9c1f2e0', 'urgent', true, 'general', 'Kick off onboarding', 'Confirm next steps, owners, timeline, and schedule the kickoff call.', 0, 'signed')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- System Config (6 rows) - AI model defaults
-- NOTE: Excludes service_role_key and supabase_url (environment-specific)
-- ============================================
INSERT INTO system_config (key, value, description) VALUES
('ai_meeting_task_model', 'anthropic/claude-haiku-4-5-20250514', 'Default task extraction model'),
('ai_meeting_sentiment_model', 'anthropic/claude-haiku-4-5-20250514', 'Default sentiment analysis model'),
('ai_proposal_model', 'anthropic/claude-3-5-sonnet-20241022', 'Default proposal generation model'),
('ai_meeting_summary_model', 'anthropic/claude-haiku-4-5-20250514', 'Default meeting summary model'),
('waitlist_slack_org_id', 'TC9L5P14P', 'Slack workspace ID for waitlist notifications'),
('waitlist_slack_channel_id', 'C0A5F7BKJKU', 'Slack channel ID for waitlist notifications')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Intervention Templates (9 rows)
-- Permission-to-close email templates for sales recovery
-- ============================================
INSERT INTO intervention_templates (id, tags, is_active, description, usage_notes, subject_line, variant_name, template_body, template_name, template_type, context_trigger, is_control_variant, is_system_template, parent_template_id, recommended_timing, personalization_fields) VALUES
('45218ffe-8326-46f7-a301-fe68dadcc0b2', ARRAY['permission_to_close','proposal','ghosting','follow_up'], true, 'Classic permission to close template for use after sending a proposal with no response', 'Use this when you have sent a proposal and have not heard back after 7+ days. Works best when you have had meaningful discussions prior to sending the proposal.', 'Re: {{company_name}} Proposal', 'control', E'Hey {{first_name}},\n\nI have not heard back from you since {{last_meaningful_interaction}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will close the file on this for now and we can {{reconnect_suggestion}}.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - After Proposal', 'permission_to_close', 'after_proposal', true, true, NULL, 'After 2-3 ignored follow-ups, 7-14 days after proposal sent', '{"fields": ["first_name", "company_name", "last_meaningful_interaction", "personalized_assumption", "reconnect_suggestion", "sender_name"]}'::jsonb),
('5d58e2fb-97ee-4521-9f76-33c7f15fb314', ARRAY['permission_to_close','demo','product_demo','ghosting'], true, 'Permission to close after demo or product walkthrough with no response', 'Use after a demo when prospect goes silent. Reference specific concerns or topics from the demo.', 'Re: {{company_name}} Demo', 'control', E'Hey {{first_name}},\n\nI have not heard back since our call about {{demo_topic}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will close the file on this for now and we can reconnect when it makes more sense.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - After Demo', 'permission_to_close', 'after_demo', true, true, NULL, 'After 2 ignored follow-ups, 5-10 days after demo', '{"fields": ["first_name", "company_name", "demo_topic", "personalized_assumption", "sender_name"]}'::jsonb),
('8437397d-4890-4bd2-a7c0-84adb9422b00', ARRAY['permission_to_close','meeting','reschedule','no_show'], true, 'Use when meeting was rescheduled multiple times without new date set', 'Works when prospect cancels/reschedules 2+ times without providing new availability.', 'Re: Rescheduling Our Call', 'control', E'Hey {{first_name}},\n\nHave not been able to reconnect since we had to reschedule our {{meeting_type}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will take this off your plate for now - reach out when timing is better.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - Meeting Rescheduled', 'permission_to_close', 'meeting_rescheduled', true, true, NULL, 'After 2 reschedules without new date, 7+ days after last cancellation', '{"fields": ["first_name", "meeting_type", "personalized_assumption", "sender_name"]}'::jsonb),
('01add8bb-cb7c-4e1d-9940-3d9fbfaa2347', ARRAY['permission_to_close','follow_up','ghosting','materials_sent'], true, 'Use when prospect requested information then went silent after you sent it', 'Effective when you sent requested materials and they have ignored 2+ follow-ups.', 'Re: {{topic}}', 'control', E'Hey {{first_name}},\n\nI have not heard back since I sent over {{last_item_sent}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will close the file on this for now and we can connect again when the stars align.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - Multiple Follow-ups Ignored', 'permission_to_close', 'multiple_followups_ignored', true, true, NULL, 'After 2-3 ignored follow-ups, 7-14 days after sending materials', '{"fields": ["first_name", "topic", "last_item_sent", "personalized_assumption", "sender_name"]}'::jsonb),
('f78fdc7a-9549-44df-ab5e-948b74f41642', ARRAY['permission_to_close','technical','integration','engineering'], true, 'Use when you answered technical questions but prospect went silent', 'Works when technical discussions stall. Reference specific concerns from their questions.', 'Re: {{technical_topic}}', 'control', E'Hey {{first_name}},\n\nHave not heard back since I answered your questions about {{technical_topic}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will close the file on this for now - happy to reconnect when {{specific_condition}}.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - Technical Questions Unanswered', 'permission_to_close', 'after_technical_questions', true, true, NULL, 'After 1-2 ignored follow-ups, 7-10 days after answering questions', '{"fields": ["first_name", "technical_topic", "personalized_assumption", "specific_condition", "sender_name"]}'::jsonb),
('c46b3ddc-0dc8-4951-af0e-582ec4eaf481', ARRAY['permission_to_close','champion','internal_blockers','politics'], true, 'Use when your internal champion stops responding', 'Effective when someone who was actively championing your solution goes dark.', 'Re: {{initiative}}', 'control', E'Hey {{first_name}},\n\nI have not heard from you since our last check-in about {{initiative}}.\n\nI am guessing {{personalized_assumption}}.\n\nI will take this off your radar for now - let me know if circumstances change.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - Champion Quiet', 'permission_to_close', 'champion_quiet', true, true, NULL, 'After 2 ignored check-ins, 10-14 days since last contact', '{"fields": ["first_name", "initiative", "personalized_assumption", "sender_name"]}'::jsonb),
('00f11a05-db68-4074-a5aa-c1906fa79653', ARRAY['permission_to_close','ab_test','variant_a','specific'], true, 'A/B test variant that references specific concerns from conversations', 'More specific than control. Reference exact concerns or objections raised.', 'Re: {{topic}}', 'more_specific', E'Hey {{first_name}},\n\nI have not heard back from you since {{last_meaningful_interaction}}.\n\nI am guessing {{specific_concern}} is still a blocker or the timing just is not right.\n\nI will close the file on this for now and we can reconnect when it makes sense.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - More Specific (Variant A)', 'permission_to_close', 'general_ghosting', false, true, '45218ffe-8326-46f7-a301-fe68dadcc0b2', 'After 2-3 ignored follow-ups', '{"fields": ["first_name", "topic", "last_meaningful_interaction", "specific_concern", "sender_name"]}'::jsonb),
('32de5364-b194-4590-9210-cc40db2a9def', ARRAY['permission_to_close','ab_test','variant_b','vulnerable'], true, 'A/B test variant with more vulnerable, self-aware positioning', 'Takes ownership for potentially missing the mark. More vulnerable approach.', 'Re: {{topic}}', 'more_vulnerable', E'Hey {{first_name}},\n\nI have not heard back from you since {{last_meaningful_interaction}}.\n\nI am guessing I missed the mark on what you are actually trying to solve or this is not a priority right now.\n\nI will close the file on this for now and we can reconnect if things change.\n\nAll the best,\n{{sender_name}}', 'Permission to Close - More Vulnerable (Variant B)', 'permission_to_close', 'general_ghosting', false, true, '45218ffe-8326-46f7-a301-fe68dadcc0b2', 'After 2-3 ignored follow-ups', '{"fields": ["first_name", "topic", "last_meaningful_interaction", "sender_name"]}'::jsonb),
('ff5a9508-5114-4713-beed-ee2baf64f509', ARRAY['permission_to_close','ab_test','variant_c','question'], true, 'A/B test variant using a question format for decision forcing', 'Uses question to force a decision without applying pressure.', 'Re: {{topic}}', 'question_format', E'Hey {{first_name}},\n\nI have not heard back since {{last_meaningful_interaction}}.\n\nShould I take this off your radar for now, or is there something else I can do to help move this forward?\n\nAll the best,\n{{sender_name}}', 'Permission to Close - Question Format (Variant C)', 'permission_to_close', 'general_ghosting', false, true, '45218ffe-8326-46f7-a301-fe68dadcc0b2', 'After 2-3 ignored follow-ups', '{"fields": ["first_name", "topic", "last_meaningful_interaction", "sender_name"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;
