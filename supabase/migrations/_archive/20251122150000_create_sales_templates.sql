-- Sales Templates System Migration
-- Creates tables for AI-powered sales email templates integrated with Calendar/CRM

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SALES TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'meeting_followup',    -- Post-meeting follow-ups
    'initial_outreach',    -- Cold outreach
    'nurture_sequence',    -- Ongoing nurture
    'deal_progression',    -- Move deals forward
    'reengagement',        -- Reconnect with cold leads
    'thank_you',          -- Gratitude emails
    'custom'              -- User-defined custom templates
  )),

  -- Template content with variable placeholders
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- AI personalization configuration
  ai_instructions TEXT,              -- Custom instructions for AI personalization
  tone TEXT DEFAULT 'professional' CHECK (tone IN (
    'professional',
    'friendly',
    'concise',
    'urgent'
  )),

  -- Variables and context requirements
  required_variables TEXT[] DEFAULT '{}',  -- e.g., ['contact_name', 'company_name']
  optional_variables TEXT[] DEFAULT '{}',  -- e.g., ['meeting_date', 'deal_value']
  context_types TEXT[] DEFAULT '{}',       -- ['calendar_event', 'contact', 'deal', 'user_profile']

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Effectiveness metrics
  avg_response_rate DECIMAL(5,2) DEFAULT 0.00,  -- Percentage of emails that got responses
  avg_conversion_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage that led to conversions

  -- Sharing and visibility
  is_active BOOLEAN DEFAULT TRUE,
  is_shared BOOLEAN DEFAULT FALSE,   -- Share across organization
  is_default BOOLEAN DEFAULT FALSE,  -- System default templates

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR SALES TEMPLATES
-- =====================================================
CREATE INDEX idx_sales_templates_user
  ON sales_templates(user_id)
  WHERE is_active = TRUE;

CREATE INDEX idx_sales_templates_org
  ON sales_templates(org_id)
  WHERE is_active = TRUE;

CREATE INDEX idx_sales_templates_category
  ON sales_templates(category)
  WHERE is_active = TRUE;

CREATE INDEX idx_sales_templates_shared
  ON sales_templates(org_id, is_shared)
  WHERE is_shared = TRUE AND is_active = TRUE;

CREATE INDEX idx_sales_templates_usage
  ON sales_templates(usage_count DESC, last_used_at DESC)
  WHERE is_active = TRUE;

-- Full-text search on template name and description
CREATE INDEX idx_sales_templates_search
  ON sales_templates USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
  );

-- =====================================================
-- TEMPLATE USAGE LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS template_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES sales_templates(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Context of usage
  used_for TEXT NOT NULL CHECK (used_for IN (
    'email',
    'calendar_followup',
    'deal_action',
    'contact_outreach'
  )),

  -- Related entities
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- Email tracking (integrated with email service)
  email_id TEXT,                    -- External email ID for tracking
  email_sent BOOLEAN DEFAULT FALSE,
  email_opened BOOLEAN DEFAULT FALSE,
  email_replied BOOLEAN DEFAULT FALSE,
  reply_time_hours INTEGER,         -- Hours until reply

  -- Effectiveness tracking
  converted BOOLEAN DEFAULT FALSE,  -- Led to desired outcome
  conversion_type TEXT,             -- e.g., 'meeting_scheduled', 'deal_closed', 'response_received'
  conversion_value DECIMAL(10,2),   -- Monetary value if applicable

  -- AI personalization metadata
  ai_personalized BOOLEAN DEFAULT FALSE,
  personalization_quality DECIMAL(3,2),  -- Quality score 0-1

  -- Metadata
  used_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR TEMPLATE USAGE LOGS
-- =====================================================
CREATE INDEX idx_template_usage_template
  ON template_usage_logs(template_id, used_at DESC);

CREATE INDEX idx_template_usage_user
  ON template_usage_logs(user_id, used_at DESC);

CREATE INDEX idx_template_usage_effectiveness
  ON template_usage_logs(template_id, converted)
  WHERE converted = TRUE;

CREATE INDEX idx_template_usage_contact
  ON template_usage_logs(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX idx_template_usage_deal
  ON template_usage_logs(deal_id)
  WHERE deal_id IS NOT NULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sales_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update template effectiveness metrics
CREATE OR REPLACE FUNCTION update_template_metrics(template_id UUID)
RETURNS VOID AS $$
DECLARE
  total_uses INTEGER;
  total_responses INTEGER;
  total_conversions INTEGER;
BEGIN
  -- Get counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE email_replied = TRUE),
    COUNT(*) FILTER (WHERE converted = TRUE)
  INTO
    total_uses,
    total_responses,
    total_conversions
  FROM template_usage_logs
  WHERE template_usage_logs.template_id = update_template_metrics.template_id;

  -- Update template metrics
  IF total_uses > 0 THEN
    UPDATE sales_templates
    SET
      avg_response_rate = (total_responses::DECIMAL / total_uses::DECIMAL) * 100,
      avg_conversion_rate = (total_conversions::DECIMAL / total_uses::DECIMAL) * 100,
      updated_at = NOW()
    WHERE id = template_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update metrics when usage log is updated
CREATE OR REPLACE FUNCTION trigger_update_template_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update metrics for the template
  PERFORM update_template_metrics(NEW.template_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_template_usage_metrics
AFTER INSERT OR UPDATE ON template_usage_logs
FOR EACH ROW
EXECUTE FUNCTION trigger_update_template_metrics();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_sales_templates
BEFORE UPDATE ON sales_templates
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_template_usage_logs
BEFORE UPDATE ON template_usage_logs
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE sales_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_logs ENABLE ROW LEVEL SECURITY;

-- ===== SALES TEMPLATES POLICIES =====

-- Users can view their own templates and shared organization templates
CREATE POLICY "Users can view own and shared templates"
ON sales_templates FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    is_shared = TRUE
    AND org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  )
  OR is_default = TRUE  -- Everyone can see default templates
);

-- Users can create their own templates
CREATE POLICY "Users can create templates"
ON sales_templates FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid()
  )
);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
ON sales_templates FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own non-default templates
CREATE POLICY "Users can delete own templates"
ON sales_templates FOR DELETE
USING (
  user_id = auth.uid()
  AND is_default = FALSE
);

-- ===== TEMPLATE USAGE LOGS POLICIES =====

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
ON template_usage_logs FOR SELECT
USING (user_id = auth.uid());

-- Users can create usage logs for their own actions
CREATE POLICY "Users can create usage logs"
ON template_usage_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own usage logs (for tracking opens, replies, etc.)
CREATE POLICY "Users can update own usage logs"
ON template_usage_logs FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own usage logs
CREATE POLICY "Users can delete own usage logs"
ON template_usage_logs FOR DELETE
USING (user_id = auth.uid());

-- =====================================================
-- DEFAULT TEMPLATES SEEDING
-- =====================================================

-- Seed 5 default high-quality templates
INSERT INTO sales_templates (
  name,
  description,
  category,
  subject_template,
  body_template,
  tone,
  ai_instructions,
  required_variables,
  optional_variables,
  context_types,
  is_default,
  is_active,
  user_id,
  created_by
) VALUES
(
  'Meeting Follow-up',
  'Professional follow-up email after a meeting to summarize discussion and outline next steps',
  'meeting_followup',
  'Great connecting on {{meeting_date}} - Next steps',
  E'Hi {{contact_first_name}},\n\nThank you for taking the time to meet with me on {{meeting_date}}. I enjoyed our conversation about {{meeting_title}}.\n\nAs we discussed, here are the key points and next steps:\n\n• [AI will personalize based on meeting notes and context]\n• [Action items for both parties]\n• [Timeline and milestones]\n\nI''ll follow up {{followup_timeline}} to check on progress. Please don''t hesitate to reach out if you have any questions in the meantime.\n\nLooking forward to working together!\n\nBest regards,\n{{sender_name}}\n{{sender_title}}',
  'professional',
  'Personalize the bullet points based on actual meeting content. Include specific action items discussed, reference key pain points mentioned, and suggest concrete next steps relevant to the conversation.',
  ARRAY['contact_name', 'meeting_date', 'sender_name'],
  ARRAY['meeting_title', 'contact_first_name', 'sender_title', 'followup_timeline'],
  ARRAY['calendar_event', 'contact', 'user_profile'],
  TRUE,
  TRUE,
  (SELECT id FROM auth.users LIMIT 1),  -- Use first admin user
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Initial Sales Outreach',
  'Friendly introduction email for cold outreach with value proposition',
  'initial_outreach',
  'Quick intro - {{company_name}}',
  E'Hi {{contact_first_name}},\n\nI hope this email finds you well. I''m reaching out because I noticed {{company_name}} [AI will personalize based on company research].\n\nMany companies in your industry are facing challenges with [AI will identify relevant pain points]. We''ve helped similar organizations achieve [specific outcomes].\n\nWould you be open to a brief 15-minute call next week to discuss how we might help {{company_name}} with [value proposition]?\n\nBest regards,\n{{sender_name}}\n{{sender_title}}',
  'friendly',
  'Research the company and personalize the introduction. Identify their likely pain points based on industry, size, and public information. Keep tone warm but professional.',
  ARRAY['contact_name', 'company_name', 'sender_name'],
  ARRAY['contact_first_name', 'sender_title', 'contact_title'],
  ARRAY['contact', 'user_profile'],
  TRUE,
  TRUE,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Deal Progression',
  'Email to move deal forward after verbal commitment or positive signal',
  'deal_progression',
  'Next steps for {{company_name}} - {{deal_stage}}',
  E'Hi {{contact_first_name}},\n\nThanks for your continued interest in moving forward! I''m excited about the potential partnership between {{company_name}} and our team.\n\nBased on our conversations, here''s what I propose for the next steps:\n\n1. [AI will suggest specific next steps based on deal stage]\n2. [Timeline and milestones]\n3. [Required documentation or approvals]\n\nOur team is ready to support you through this process. The value we discussed - {{deal_value}} - represents [ROI or benefit statement].\n\nShall we schedule a call {{proposed_next_meeting}} to discuss any questions?\n\nBest regards,\n{{sender_name}}',
  'professional',
  'Tailor next steps to the specific deal stage. If in verbal stage, focus on contract and approval process. If in opportunity, focus on demo or proof of concept. Reference specific value discussed.',
  ARRAY['contact_name', 'company_name', 'sender_name'],
  ARRAY['contact_first_name', 'deal_stage', 'deal_value', 'proposed_next_meeting'],
  ARRAY['contact', 'deal', 'user_profile'],
  TRUE,
  TRUE,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Re-engagement Email',
  'Gentle follow-up to reconnect with cold or unresponsive leads',
  'reengagement',
  'Checking in - {{company_name}}',
  E'Hi {{contact_first_name}},\n\nI wanted to follow up on my previous email about [previous topic]. I understand things get busy, and timing isn''t always right.\n\nSince we last connected, we''ve [recent development, case study, or new offering that might be relevant].\n\nI''d love to reconnect if you''re interested, but I also don''t want to fill your inbox unnecessarily. Would it be helpful to schedule a brief call, or should I check back in a few months?\n\nEither way, wishing {{company_name}} continued success!\n\nBest regards,\n{{sender_name}}',
  'friendly',
  'Keep tone warm and understanding. Reference previous conversations naturally. Mention new developments or case studies that might renew interest. Give them an easy out if not interested.',
  ARRAY['contact_name', 'company_name', 'sender_name'],
  ARRAY['contact_first_name'],
  ARRAY['contact', 'user_profile'],
  TRUE,
  TRUE,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Thank You Email',
  'Gracious thank you email after successful deal closure or positive outcome',
  'thank_you',
  'Thank you, {{contact_first_name}}!',
  E'Hi {{contact_first_name}},\n\nI wanted to take a moment to personally thank you for choosing to work with us. Your trust means everything to our team.\n\nWe''re excited to deliver [specific outcomes or value] for {{company_name}}. Our onboarding team will be reaching out shortly to ensure a smooth start.\n\nIf you have any questions or concerns at any point, please don''t hesitate to reach out to me directly. We''re committed to your success.\n\nLooking forward to a great partnership!\n\nWarm regards,\n{{sender_name}}\n{{sender_title}}',
  'friendly',
  'Keep warm and genuine. Reference specific value they''ll receive. Personalize based on what excited them during the sales process.',
  ARRAY['contact_name', 'sender_name'],
  ARRAY['contact_first_name', 'company_name', 'sender_title'],
  ARRAY['contact', 'deal', 'user_profile'],
  TRUE,
  TRUE,
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1)
);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE sales_templates IS 'AI-powered sales email templates with variable replacement and context-aware personalization';
COMMENT ON TABLE template_usage_logs IS 'Usage tracking and effectiveness metrics for sales templates';

COMMENT ON COLUMN sales_templates.ai_instructions IS 'Custom instructions passed to AI for personalizing this template';
COMMENT ON COLUMN sales_templates.context_types IS 'Types of context data needed: calendar_event, contact, deal, user_profile';
COMMENT ON COLUMN sales_templates.required_variables IS 'Variables that must be provided for template to work';
COMMENT ON COLUMN sales_templates.optional_variables IS 'Variables that enhance template but are not required';

COMMENT ON FUNCTION increment_template_usage IS 'Increments usage count and updates last_used_at for a template';
COMMENT ON FUNCTION update_template_metrics IS 'Recalculates response rate and conversion rate metrics from usage logs';
