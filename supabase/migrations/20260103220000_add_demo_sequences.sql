-- Migration: Add Demo Agent Sequences
-- Purpose: Pre-populate agent sequences for impressive demos
-- Date: 2026-01-03

-- =============================================================================
-- Insert Demo Sequences
-- =============================================================================

-- Note: These sequences will be available to all platform admins
-- They demonstrate the power of skill chaining with HITL support

INSERT INTO platform_skills (skill_key, category, frontmatter, content_template, is_active)
VALUES
  -- =============================================================================
  -- Sequence 1: Prospecting Power Package
  -- Combines lead research + image generation + email draft
  -- =============================================================================
  (
    'seq-prospecting-power',
    'agent-sequence',
    '{
      "name": "Prospecting Power Package",
      "description": "Full prospecting workflow: research the company, generate a personalized visual, and draft outreach email. Perfect for impressing high-value prospects.",
      "category": "agent-sequence",
      "input_schema": {
        "domain": {"type": "string", "required": true, "description": "Company domain to research (e.g., stripe.com)"},
        "prospect_name": {"type": "string", "required": false, "description": "Name of the person to contact"},
        "prospect_role": {"type": "string", "required": false, "description": "Role/title of the prospect"},
        "outreach_context": {"type": "string", "required": false, "description": "Context for the outreach (e.g., following up from conference)"}
      },
      "output_schema": {
        "company_research": {"type": "object"},
        "personalized_image": {"type": "object"},
        "email_draft": {"type": "object"}
      },
      "sequence_steps": [
        {
          "order": 1,
          "skill_key": "lead-research",
          "input_mapping": {
            "domain": "${domain}",
            "company_name": "${company_name}"
          },
          "output_key": "research",
          "on_failure": "stop"
        },
        {
          "order": 2,
          "skill_key": "prospect-visual",
          "input_mapping": {
            "company_name": "${research.company_overview}",
            "industry": "${research.industry}",
            "prospect_name": "${prospect_name}",
            "prospect_role": "${prospect_role}",
            "outreach_context": "${outreach_context}",
            "visual_theme": "professional business"
          },
          "output_key": "visual",
          "on_failure": "continue"
        },
        {
          "order": 3,
          "skill_key": "draft-email",
          "input_mapping": {
            "to": "${prospect_name}",
            "subject": "Quick note about ${research.company_overview}",
            "context": "Research findings: ${research.outreach_angles}. Pain points: ${research.pain_points}. Recent news: ${research.recent_news}",
            "tone": "professional but personalized"
          },
          "output_key": "email",
          "on_failure": "stop",
          "hitl_after": {
            "enabled": true,
            "request_type": "confirmation",
            "prompt": "Review the email draft for ${prospect_name}. Ready to send?",
            "channels": ["in_app", "slack"],
            "timeout_minutes": 60,
            "timeout_action": "fail"
          }
        }
      ],
      "tags": ["prospecting", "research", "outreach", "demo"]
    }',
    'Full prospecting package with company research, personalized visuals, and tailored email draft.',
    true
  ),

  -- =============================================================================
  -- Sequence 2: Meeting Mastery
  -- Prep for meeting + talking points + follow-up email
  -- =============================================================================
  (
    'seq-meeting-mastery',
    'agent-sequence',
    '{
      "name": "Meeting Mastery",
      "description": "Complete meeting workflow: research attendees, generate talking points, and create follow-up email after the meeting.",
      "category": "agent-sequence",
      "input_schema": {
        "company_domain": {"type": "string", "required": true, "description": "Domain of the company you are meeting with"},
        "contact_name": {"type": "string", "required": true, "description": "Name of the primary contact"},
        "contact_email": {"type": "string", "required": false, "description": "Email of the primary contact"},
        "meeting_type": {"type": "string", "required": false, "description": "Type of meeting (discovery, demo, negotiation)"}
      },
      "output_schema": {
        "company_intel": {"type": "object"},
        "talking_points": {"type": "object"},
        "followup_email": {"type": "object"}
      },
      "sequence_steps": [
        {
          "order": 1,
          "skill_key": "company-analysis",
          "input_mapping": {
            "domain": "${company_domain}",
            "company_name": "${company_name}",
            "context": "Preparing for ${meeting_type} meeting with ${contact_name}"
          },
          "output_key": "intel",
          "on_failure": "continue"
        },
        {
          "order": 2,
          "skill_key": "meeting-prep",
          "input_mapping": {
            "company_name": "${intel.executive_summary}",
            "contact_name": "${contact_name}",
            "contact_title": "${contact_role}",
            "meeting_type": "${meeting_type}",
            "company_context": "${intel.strategic_analysis}"
          },
          "output_key": "prep",
          "on_failure": "continue"
        },
        {
          "order": 3,
          "skill_key": "draft-email",
          "input_mapping": {
            "to": "${contact_email}",
            "subject": "Following up on our ${meeting_type} conversation",
            "context": "Meeting prep: ${prep.talking_points}. Company intel: ${intel.sales_intelligence}",
            "tone": "professional and action-oriented"
          },
          "output_key": "followup",
          "on_failure": "stop",
          "hitl_before": {
            "enabled": true,
            "request_type": "confirmation",
            "prompt": "The meeting with ${contact_name} has ended. Ready to generate the follow-up email?",
            "channels": ["in_app"],
            "timeout_minutes": 1440,
            "timeout_action": "fail"
          }
        }
      ],
      "tags": ["meeting", "prep", "followup", "demo"]
    }',
    'Complete meeting workflow from prep to follow-up.',
    true
  ),

  -- =============================================================================
  -- Sequence 3: Deal Rescue Mission
  -- Analyze deal health + competitive intel + re-engagement email
  -- =============================================================================
  (
    'seq-deal-rescue',
    'agent-sequence',
    '{
      "name": "Deal Rescue Mission",
      "description": "Revive stale or at-risk deals: analyze deal health, gather competitive intelligence, and craft a compelling re-engagement message.",
      "category": "agent-sequence",
      "input_schema": {
        "deal_id": {"type": "string", "required": true, "description": "ID of the deal to rescue"},
        "company_name": {"type": "string", "required": true, "description": "Name of the prospect company"},
        "primary_competitor": {"type": "string", "required": false, "description": "Main competitor being considered"}
      },
      "output_schema": {
        "deal_analysis": {"type": "object"},
        "competitive_intel": {"type": "object"},
        "rescue_email": {"type": "object"}
      },
      "sequence_steps": [
        {
          "order": 1,
          "skill_key": "deal-health-analyzer",
          "input_mapping": {
            "deal_id": "${deal_id}",
            "company_name": "${company_name}"
          },
          "output_key": "health",
          "on_failure": "continue"
        },
        {
          "order": 2,
          "skill_key": "competitor-intel",
          "input_mapping": {
            "competitor_name": "${primary_competitor}",
            "our_company": "Sixty",
            "context": "Deal at risk, prospect considering ${primary_competitor}"
          },
          "output_key": "competitor",
          "on_failure": "continue"
        },
        {
          "order": 3,
          "skill_key": "draft-email",
          "input_mapping": {
            "to": "${contact_email}",
            "subject": "Quick question about your evaluation",
            "context": "Deal health: ${health.analysis}. Competitive positioning: ${competitor.battle_card.win_strategies}",
            "tone": "helpful, not pushy"
          },
          "output_key": "rescue_email",
          "on_failure": "stop",
          "hitl_after": {
            "enabled": true,
            "request_type": "choice",
            "prompt": "Review the rescue email. What would you like to do?",
            "options": [
              {"value": "send", "label": "Send Now"},
              {"value": "edit", "label": "Edit First"},
              {"value": "schedule", "label": "Schedule for Later"},
              {"value": "discard", "label": "Discard"}
            ],
            "channels": ["in_app", "slack"],
            "timeout_minutes": 120,
            "timeout_action": "fail"
          }
        }
      ],
      "tags": ["deal", "rescue", "competitive", "demo"]
    }',
    'Deal recovery workflow with competitive analysis and re-engagement.',
    true
  ),

  -- =============================================================================
  -- Sequence 4: Weekly Pipeline Intelligence
  -- Full pipeline analysis with health scores and visual report
  -- =============================================================================
  (
    'seq-pipeline-intelligence',
    'agent-sequence',
    '{
      "name": "Weekly Pipeline Intelligence",
      "description": "Comprehensive pipeline review: analyze all active deals, score their health, identify at-risk opportunities, and generate a visual summary.",
      "category": "agent-sequence",
      "input_schema": {
        "period": {"type": "string", "required": false, "description": "Time period for analysis (this_week, this_month)"},
        "include_forecast": {"type": "boolean", "required": false, "description": "Include forecast analysis"}
      },
      "output_schema": {
        "pipeline_summary": {"type": "object"},
        "deal_health_scores": {"type": "array"},
        "forecast": {"type": "object"},
        "visual_report": {"type": "object"}
      },
      "sequence_steps": [
        {
          "order": 1,
          "skill_key": "get_pipeline_summary",
          "input_mapping": {
            "period": "${period}"
          },
          "output_key": "pipeline",
          "on_failure": "stop"
        },
        {
          "order": 2,
          "skill_key": "deal-health-analyzer",
          "input_mapping": {
            "deals": "${pipeline.deals}",
            "analysis_type": "batch"
          },
          "output_key": "health",
          "on_failure": "continue"
        },
        {
          "order": 3,
          "skill_key": "get_pipeline_forecast",
          "input_mapping": {
            "period": "${period}",
            "health_data": "${health}"
          },
          "output_key": "forecast",
          "on_failure": "continue"
        },
        {
          "order": 4,
          "skill_key": "image-generation",
          "input_mapping": {
            "purpose": "Pipeline intelligence summary visualization",
            "style": "professional infographic",
            "subject": "Pipeline health dashboard showing ${pipeline.total_value} in pipeline, ${health.at_risk_count} at risk, ${forecast.predicted_close_rate}% predicted close rate",
            "details": "Clean, modern design with key metrics highlighted"
          },
          "output_key": "visual",
          "on_failure": "continue"
        }
      ],
      "tags": ["pipeline", "analysis", "forecast", "demo"]
    }',
    'Weekly pipeline review with health scoring and visual reporting.',
    true
  )
ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =============================================================================
-- Add additional helper skills needed by sequences
-- =============================================================================

-- Add draft-email skill if it doesn't exist
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template, is_active)
VALUES
  (
    'draft-email',
    'writing',
    '{
      "name": "Email Draft Generator",
      "description": "Generate professional email drafts based on context and desired tone.",
      "category": "writing",
      "input_schema": {
        "to": {"type": "string", "required": false, "description": "Recipient name or email"},
        "subject": {"type": "string", "required": false, "description": "Email subject line"},
        "context": {"type": "string", "required": true, "description": "Context for the email (what to include)"},
        "tone": {"type": "string", "required": false, "description": "Desired tone (professional, friendly, urgent)"}
      },
      "output_schema": {
        "subject": {"type": "string"},
        "body": {"type": "string"},
        "cta": {"type": "string"}
      }
    }',
    'Generate a professional email draft based on context.',
    true
  ),

  (
    'meeting-prep',
    'sales-ai',
    '{
      "name": "Meeting Prep Assistant",
      "description": "Prepare for meetings with talking points, research, and agenda suggestions.",
      "category": "sales-ai",
      "input_schema": {
        "company_name": {"type": "string", "required": true, "description": "Company name"},
        "contact_name": {"type": "string", "required": false, "description": "Contact name"},
        "contact_title": {"type": "string", "required": false, "description": "Contact title/role"},
        "meeting_type": {"type": "string", "required": false, "description": "Type of meeting"},
        "company_context": {"type": "string", "required": false, "description": "Additional context about the company"}
      },
      "output_schema": {
        "talking_points": {"type": "array"},
        "questions_to_ask": {"type": "array"},
        "risks_to_address": {"type": "array"},
        "next_steps": {"type": "array"}
      }
    }',
    'Generate meeting prep materials with talking points.',
    true
  ),

  (
    'deal-health-analyzer',
    'sales-ai',
    '{
      "name": "Deal Health Analyzer",
      "description": "Analyze deal health based on activity, engagement, and signals.",
      "category": "sales-ai",
      "input_schema": {
        "deal_id": {"type": "string", "required": false, "description": "Deal ID to analyze"},
        "deals": {"type": "array", "required": false, "description": "Array of deals for batch analysis"},
        "company_name": {"type": "string", "required": false, "description": "Company name"},
        "analysis_type": {"type": "string", "required": false, "description": "single or batch"}
      },
      "output_schema": {
        "health_score": {"type": "number"},
        "risk_factors": {"type": "array"},
        "positive_signals": {"type": "array"},
        "recommendations": {"type": "array"},
        "analysis": {"type": "string"}
      }
    }',
    'Analyze deal health and identify risk factors.',
    true
  )
ON CONFLICT (skill_key) DO NOTHING;
