-- Migration: Seed Core Agent Sequences
-- Purpose: Insert the 8 core sequence patterns from Context Engineering architecture
-- Date: 2026-01-04
--
-- These sequences implement the full agent sequence architecture with:
-- - Context Engineering principles (compaction, isolation, hierarchical tools)
-- - HITL (Human-in-the-Loop) approval at key decision points
-- - Skill pipelines for each sequence type

-- =============================================================================
-- Sequence 1: Post-Meeting Intelligence
-- =============================================================================
-- Purpose: Transform every sales meeting into structured CRM updates,
-- personalized follow-ups, and actionable next steps — automatically.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-post-meeting-intelligence',
  'agent-sequence',
  '{
    "name": "Post-Meeting Intelligence",
    "description": "Transform meeting recordings into structured CRM updates, personalized follow-ups, and actionable next steps automatically.",
    "triggers": ["meeting_recording_processed", "meetingbaas_webhook"],
    "requires_context": ["meeting_id", "recording_url"],
    "outputs": ["meeting_analysis", "crm_updates", "follow_up_draft", "action_items"],
    "priority": "high",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "transcription",
        "input_mapping": {"recording_url": "${trigger.params.recording_url}"},
        "output_key": "transcript",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "meeting-analyzer",
        "input_mapping": {
          "transcript_ref": "${context.references[0].location}",
          "deal_context": "${context.entities.deals[0]}"
        },
        "output_key": "analysis",
        "on_failure": "stop"
      },
      {
        "order": 3,
        "skill_key": "crm-updater",
        "input_mapping": {
          "analysis_data": "${context.findings}",
          "deal_id": "${context.entities.deals[0].id}"
        },
        "output_key": "crm_updates",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "follow-up-email",
        "input_mapping": {
          "analysis_data": "${context.findings}",
          "contact": "${context.entities.contacts[0]}",
          "company": "${context.entities.companies[0]}"
        },
        "output_key": "follow_up_draft",
        "on_failure": "fallback",
        "fallback_skill_key": "simple-follow-up"
      },
      {
        "order": 5,
        "skill_key": "slack-presenter",
        "input_mapping": {
          "sequence_state": "${context}",
          "channel_id": "${trigger.params.slack_channel_id}"
        },
        "output_key": "slack_notification",
        "on_failure": "continue",
        "hitl_after": {
          "enabled": true,
          "request_type": "choice",
          "prompt": "Review the meeting summary and follow-up draft for ${context.entities.companies[0].name}. Would you like to send the follow-up email?",
          "options": [
            {"value": "approve_send", "label": "Approve & Send"},
            {"value": "edit", "label": "Edit First"},
            {"value": "reject", "label": "Skip Follow-up"}
          ],
          "channels": ["slack", "in_app"],
          "timeout_minutes": 120,
          "timeout_action": "continue"
        }
      },
      {
        "order": 6,
        "skill_key": "executor",
        "input_mapping": {
          "approved_actions": "${outputs.drafts}",
          "approval_response": "${context.approval}"
        },
        "output_key": "execution_result",
        "on_failure": "continue"
      },
      {
        "order": 7,
        "skill_key": "manager-alert",
        "input_mapping": {
          "risk_flags": "${context.findings.risks}",
          "deal_value": "${context.entities.deals[0].value}",
          "competitor_mentioned": "${context.findings.key_facts}"
        },
        "output_key": "manager_notification",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Post-Meeting Intelligence Sequence

This sequence automatically processes meeting recordings and generates actionable outputs.

## Trigger Conditions for Manager Alert
- Competitor mentioned in conversation
- Deal value > £30k and risk detected
- Close date at risk
- Champion sentiment shifted negative

## Context Engineering Rules Applied
- Transcripts stored externally, only summaries in context
- Key quotes limited to 5 most relevant
- References compacted after 20 items',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 2: Daily Pipeline Pulse
-- =============================================================================
-- Purpose: Every morning, surface deals needing attention, actions to take,
-- and risks to address — before the rep opens their CRM.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-daily-pipeline-pulse',
  'agent-sequence',
  '{
    "name": "Daily Pipeline Pulse",
    "description": "Morning briefing that surfaces deals needing attention, recommended actions, and pipeline risks.",
    "triggers": ["cron_0730_weekdays"],
    "requires_context": ["user_id"],
    "outputs": ["pipeline_summary", "priority_deals", "recommended_actions"],
    "priority": "high",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "pipeline-pull",
        "input_mapping": {"user_id": "${trigger.params.user_id}", "filters": "${trigger.params.filters}"},
        "output_key": "active_deals",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "activity-scanner",
        "input_mapping": {"deal_ids": "${context.entities.deals}"},
        "output_key": "activity_history",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "risk-analyzer",
        "input_mapping": {
          "deals": "${context.entities.deals}",
          "activities": "${context.findings.key_facts}"
        },
        "output_key": "risk_analysis",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "next-best-action",
        "input_mapping": {
          "deals": "${context.entities.deals}",
          "risks": "${context.findings.risks}"
        },
        "output_key": "recommended_actions",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "priority-ranker",
        "input_mapping": {
          "deals": "${context.entities.deals}",
          "actions": "${context.findings.action_items}"
        },
        "output_key": "ranked_deals",
        "on_failure": "continue"
      },
      {
        "order": 6,
        "skill_key": "slack-briefing",
        "input_mapping": {
          "ranked_deals": "${context.entities.deals}",
          "actions": "${context.findings.action_items}",
          "user_id": "${trigger.params.user_id}"
        },
        "output_key": "briefing_sent",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Daily Pipeline Pulse Sequence

Morning briefing delivered at 07:30 on weekdays.

## Risk Detection Rules
- Stalled: No activity for X days (configurable by stage)
- Slipped: Close date in past or pushed more than twice
- Single-threaded: Only one contact engaged
- Missing next step: No scheduled follow-up
- Gone cold: Prospect has not responded to last 2+ touches

## Priority Ranking Formula
Score = (Deal Value × 0.3) + (Urgency × 0.3) + (Actionability × 0.2) + (Risk Level × 0.2)',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 3: Pre-Meeting Prep
-- =============================================================================
-- Purpose: 2 hours before any external meeting, deliver a briefing that makes
-- the rep look like they did an hour of research in 30 seconds.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-pre-meeting-prep',
  'agent-sequence',
  '{
    "name": "Pre-Meeting Prep",
    "description": "Automated meeting preparation briefing delivered 2 hours before external meetings.",
    "triggers": ["calendar_event_2h_before"],
    "requires_context": ["calendar_event_id", "attendee_emails"],
    "outputs": ["attendee_research", "company_research", "crm_history", "briefing"],
    "priority": "high",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "attendee-extractor",
        "input_mapping": {"calendar_event": "${trigger.params.calendar_event}"},
        "output_key": "external_contacts",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "linkedin-scraper",
        "input_mapping": {"contact_linkedin_urls": "${context.entities.contacts}"},
        "output_key": "linkedin_profiles",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "company-research",
        "input_mapping": {"company_domains": "${context.entities.companies}"},
        "output_key": "company_intel",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "crm-history-pull",
        "input_mapping": {
          "contact_ids": "${context.entities.contacts}",
          "company_ids": "${context.entities.companies}"
        },
        "output_key": "crm_history",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "briefing-compiler",
        "input_mapping": {
          "linkedin_profiles": "${context.references}",
          "company_intel": "${context.findings.key_facts}",
          "crm_history": "${context.findings.action_items}"
        },
        "output_key": "compiled_briefing",
        "on_failure": "fallback",
        "fallback_skill_key": "simple-briefing"
      },
      {
        "order": 6,
        "skill_key": "slack-delivery",
        "input_mapping": {
          "briefing": "${outputs.drafts[0]}",
          "user_id": "${trigger.params.user_id}"
        },
        "output_key": "briefing_delivered",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Pre-Meeting Prep Sequence

Automated briefing delivered 2 hours before external meetings.

## Trigger Filtering
- Only external attendees (exclude internal domains)
- Only meetings 15+ minutes
- Exclude "Hold" or "Blocked" calendar events
- Configurable: include/exclude specific meeting types

## Briefing Sections
1. Person: Role history, recent LinkedIn activity
2. Company: Size, funding, tech stack, news
3. Your History: Previous touches, deal notes, objections
4. Suggested Approach: Talking points based on research',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 4: Stalled Deal Revival
-- =============================================================================
-- Purpose: Proactively surface stalled deals with fresh triggers that justify
-- re-engagement, and provide ready-to-send outreach.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-stalled-deal-revival',
  'agent-sequence',
  '{
    "name": "Stalled Deal Revival",
    "description": "Surface stalled deals with fresh triggers and ready-to-send re-engagement outreach.",
    "triggers": ["cron_0800_weekdays"],
    "requires_context": ["user_id"],
    "outputs": ["stalled_deals", "triggers_found", "outreach_drafts", "opportunity_scores"],
    "priority": "medium",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "stall-detector",
        "input_mapping": {"pipeline_rules": "${trigger.params.stall_thresholds}"},
        "output_key": "stalled_deals",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "trigger-research",
        "input_mapping": {
          "company_ids": "${context.entities.companies}",
          "contact_ids": "${context.entities.contacts}"
        },
        "output_key": "fresh_triggers",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "context-analyzer",
        "input_mapping": {
          "deal_history": "${context.entities.deals}",
          "last_notes": "${context.findings.key_facts}"
        },
        "output_key": "stall_context",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "re-engagement-drafter",
        "input_mapping": {
          "triggers": "${context.findings.opportunities}",
          "context": "${context.findings}"
        },
        "output_key": "outreach_drafts",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "opportunity-scorer",
        "input_mapping": {"all_data": "${context}"},
        "output_key": "scored_opportunities",
        "on_failure": "continue"
      },
      {
        "order": 6,
        "skill_key": "slack-presenter",
        "input_mapping": {
          "scored_deals": "${context.entities.deals}",
          "drafts": "${outputs.drafts}"
        },
        "output_key": "revival_opportunities",
        "on_failure": "continue",
        "hitl_after": {
          "enabled": true,
          "request_type": "choice",
          "prompt": "Review revival opportunities. Select deals to re-engage:",
          "options": [
            {"value": "process_top", "label": "Process Top 2"},
            {"value": "process_all", "label": "Process All"},
            {"value": "skip", "label": "Skip All"}
          ],
          "channels": ["slack", "in_app"],
          "timeout_minutes": 480,
          "timeout_action": "continue"
        }
      },
      {
        "order": 7,
        "skill_key": "executor",
        "input_mapping": {"approved_outreach": "${outputs.drafts}"},
        "output_key": "execution_result",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Stalled Deal Revival Sequence

Daily scan at 08:00 to find and revive stalled deals.

## Stall Thresholds (configurable by stage)
- Discovery: 14 days no activity
- Evaluation: 21 days no activity
- Proposal: 14 days no activity
- Negotiation: 7 days no activity
- Closed Lost (recent): 90 days for check-in

## Trigger Types Detected
- Funding announced
- New leadership (especially sales/ops)
- Hiring surge in relevant roles
- Champion job change (internal promotion)
- Company news/PR
- Competitor mentioned in news
- Tech stack change

## Opportunity Scoring
Score = (Deal Value × 0.3) + (Trigger Strength × 0.3) + (Recency × 0.2) + (ICP Fit × 0.2)',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 5: Prospect to Campaign
-- =============================================================================
-- Purpose: Turn an ICP definition into validated, personalized outreach
-- ready to deploy — end to end.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-prospect-to-campaign',
  'agent-sequence',
  '{
    "name": "Prospect to Campaign",
    "description": "Turn ICP criteria into validated, personalized outreach campaigns ready to deploy.",
    "triggers": ["manual", "scheduled_prospecting"],
    "requires_context": ["icp_profile_id"],
    "outputs": ["prospects", "validated_emails", "personalized_sequences", "campaign_ready"],
    "priority": "medium",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "icp-loader",
        "input_mapping": {"icp_profile_id": "${trigger.params.icp_profile_id}"},
        "output_key": "targeting_criteria",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "prospect-finder",
        "input_mapping": {"criteria": "${context.findings.key_facts}"},
        "output_key": "raw_prospects",
        "on_failure": "stop"
      },
      {
        "order": 3,
        "skill_key": "email-validator",
        "input_mapping": {"email_list": "${context.entities.contacts}"},
        "output_key": "validated_emails",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "prospect-enricher",
        "input_mapping": {"validated_prospects": "${context.entities.contacts}"},
        "output_key": "enriched_profiles",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "outreach-drafter",
        "input_mapping": {
          "enriched_profiles": "${context.entities.contacts}",
          "outreach_template": "${trigger.params.template_id}"
        },
        "output_key": "personalized_sequences",
        "on_failure": "fallback",
        "fallback_skill_key": "simple-outreach"
      },
      {
        "order": 6,
        "skill_key": "slack-presenter",
        "input_mapping": {"campaign_plan": "${outputs}"},
        "output_key": "approval_request",
        "on_failure": "continue",
        "hitl_after": {
          "enabled": true,
          "request_type": "confirmation",
          "prompt": "Campaign ready with ${context.entities.contacts.length} validated prospects. Approve to launch?",
          "channels": ["slack", "in_app"],
          "timeout_minutes": 1440,
          "timeout_action": "fail"
        }
      },
      {
        "order": 7,
        "skill_key": "campaign-creator",
        "input_mapping": {"approved_plan": "${outputs}"},
        "output_key": "campaign_created",
        "on_failure": "stop"
      },
      {
        "order": 8,
        "skill_key": "campaign-scheduler",
        "input_mapping": {
          "campaign_id": "${outputs.crm_updates[0].entity_id}",
          "schedule": "${trigger.params.schedule}"
        },
        "output_key": "campaign_scheduled",
        "on_failure": "continue"
      },
      {
        "order": 9,
        "skill_key": "slack-confirmation",
        "input_mapping": {"campaign_details": "${outputs}"},
        "output_key": "user_notified",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Prospect to Campaign Sequence

End-to-end prospecting automation from ICP to deployed campaign.

## Pipeline Steps
1. Load ICP targeting criteria
2. Find matching prospects (Apollo)
3. Validate emails (Reoon)
4. Enrich profiles (Apollo + Gemini)
5. Draft personalized sequences
6. Present for approval
7. Create campaign (Instantly)
8. Schedule and deploy',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 6: Inbound Lead Qualification
-- =============================================================================
-- Purpose: Instantly qualify, enrich, and route inbound leads with
-- appropriate response speed.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-inbound-qualification',
  'agent-sequence',
  '{
    "name": "Inbound Lead Qualification",
    "description": "Instantly qualify, enrich, and route inbound leads with appropriate response speed.",
    "triggers": ["new_lead_webhook", "form_submission"],
    "requires_context": ["lead_email", "lead_source"],
    "outputs": ["enriched_lead", "icp_score", "routing_decision", "response_sent"],
    "priority": "critical",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "lead-capture",
        "input_mapping": {"webhook_payload": "${trigger.params}"},
        "output_key": "lead_data",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "lead-enrichment",
        "input_mapping": {
          "lead_email": "${context.entities.contacts[0].email}",
          "company": "${context.entities.companies[0]}"
        },
        "output_key": "enriched_lead",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "icp-scorer",
        "input_mapping": {
          "enriched_lead": "${context.entities.contacts[0]}",
          "icp_profile": "${trigger.params.icp_profile_id}"
        },
        "output_key": "icp_score",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "intent-analyzer",
        "input_mapping": {
          "lead_source": "${trigger.params.lead_source}",
          "behavior_data": "${trigger.params.behavior}"
        },
        "output_key": "intent_signals",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "response-drafter",
        "input_mapping": {
          "lead_context": "${context.entities.contacts[0]}",
          "score": "${context.findings.opportunities[0]}"
        },
        "output_key": "response_draft",
        "on_failure": "continue"
      },
      {
        "order": 6,
        "skill_key": "lead-router",
        "input_mapping": {
          "score": "${context.findings.opportunities[0]}",
          "intent": "${context.findings.key_facts}"
        },
        "output_key": "routing_decision",
        "on_failure": "continue"
      },
      {
        "order": 7,
        "skill_key": "executor",
        "input_mapping": {"routing_decision": "${outputs}"},
        "output_key": "execution_result",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Inbound Lead Qualification Sequence

Instant qualification and routing for inbound leads.

## Routing Logic
- Hot (score > 80, high intent): Instant Slack alert + auto-response with booking link
- Warm (score 50-80): Personalized email sequence
- Cold (score < 50): Nurture sequence

## Response Time SLA
- Hot leads: < 5 minutes
- Warm leads: < 30 minutes
- Cold leads: < 24 hours',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 7: Champion Job Change
-- =============================================================================
-- Purpose: Never miss when a champion moves to a new company — it is the
-- warmest possible outreach.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-champion-job-change',
  'agent-sequence',
  '{
    "name": "Champion Job Change",
    "description": "Track champion job changes and trigger warm outreach to their new company.",
    "triggers": ["linkedin_job_change_detected", "daily_linkedin_scan"],
    "requires_context": ["contact_id"],
    "outputs": ["job_change_details", "new_company_research", "outreach_draft", "backfill_opportunity"],
    "priority": "high",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "job-change-detector",
        "input_mapping": {"monitored_contacts": "${trigger.params.contact_ids}"},
        "output_key": "job_changes",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "new-company-research",
        "input_mapping": {"new_company": "${context.entities.companies[0]}"},
        "output_key": "company_icp_fit",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "relationship-context",
        "input_mapping": {"contact_id": "${context.entities.contacts[0].id}"},
        "output_key": "relationship_history",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "champion-outreach-drafter",
        "input_mapping": {
          "contact": "${context.entities.contacts[0]}",
          "new_company": "${context.entities.companies[0]}",
          "relationship": "${context.findings.key_facts}"
        },
        "output_key": "congrats_outreach",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "backfill-analyzer",
        "input_mapping": {"old_company": "${context.entities.companies[1]}"},
        "output_key": "backfill_opportunity",
        "on_failure": "continue"
      },
      {
        "order": 6,
        "skill_key": "slack-presenter",
        "input_mapping": {
          "champion_opportunity": "${context}",
          "backfill_opportunity": "${context.findings.opportunities}"
        },
        "output_key": "dual_opportunity_alert",
        "on_failure": "continue",
        "hitl_after": {
          "enabled": true,
          "request_type": "choice",
          "prompt": "Champion ${context.entities.contacts[0].name} moved to ${context.entities.companies[0].name}! Actions:",
          "options": [
            {"value": "send_congrats", "label": "Send Congrats Email"},
            {"value": "send_both", "label": "Send Congrats + Pursue Backfill"},
            {"value": "skip", "label": "Skip for Now"}
          ],
          "channels": ["slack", "in_app"],
          "timeout_minutes": 1440,
          "timeout_action": "continue"
        }
      },
      {
        "order": 7,
        "skill_key": "executor",
        "input_mapping": {
          "approved_actions": "${outputs.drafts}",
          "backfill_task": "${context.findings.action_items[0]}"
        },
        "output_key": "execution_result",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Champion Job Change Sequence

Track and act on champion job changes for warm outreach.

## Dual Opportunity
1. Warm outreach to champion at new company
2. Backfill opportunity at old company

## Relationship Strength Scoring
- Closed-won deal: Very strong
- Active opportunity: Strong
- Multiple meetings: Moderate
- Single interaction: Weak',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Sequence 8: Event Follow-Up
-- =============================================================================
-- Purpose: Turn conference contacts into qualified pipeline before the
-- momentum fades.

INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  is_active
) VALUES (
  'sequence-event-follow-up',
  'agent-sequence',
  '{
    "name": "Event Follow-Up",
    "description": "Turn conference contacts into qualified pipeline with tiered follow-up campaigns.",
    "triggers": ["manual", "event_ended"],
    "requires_context": ["event_name", "contact_list"],
    "outputs": ["enriched_contacts", "tiered_segments", "personalized_sequences", "campaigns_deployed"],
    "priority": "medium",
    "agents": ["60"],
    "sequence_steps": [
      {
        "order": 1,
        "skill_key": "contact-importer",
        "input_mapping": {"csv_or_list": "${trigger.params.contact_list}"},
        "output_key": "raw_contacts",
        "on_failure": "stop"
      },
      {
        "order": 2,
        "skill_key": "event-enrichment",
        "input_mapping": {"contacts": "${context.entities.contacts}"},
        "output_key": "enriched_contacts",
        "on_failure": "continue"
      },
      {
        "order": 3,
        "skill_key": "email-validator",
        "input_mapping": {"emails": "${context.entities.contacts}"},
        "output_key": "validated_list",
        "on_failure": "continue"
      },
      {
        "order": 4,
        "skill_key": "event-segmenter",
        "input_mapping": {
          "contacts": "${context.entities.contacts}",
          "notes": "${trigger.params.interaction_notes}"
        },
        "output_key": "tiered_segments",
        "on_failure": "continue"
      },
      {
        "order": 5,
        "skill_key": "event-outreach-drafter",
        "input_mapping": {
          "tiered_contacts": "${context.entities.contacts}",
          "event_context": "${trigger.params.event_name}"
        },
        "output_key": "personalized_sequences",
        "on_failure": "continue"
      },
      {
        "order": 6,
        "skill_key": "slack-presenter",
        "input_mapping": {"tiered_plan": "${outputs}"},
        "output_key": "approval_request",
        "on_failure": "continue",
        "hitl_after": {
          "enabled": true,
          "request_type": "confirmation",
          "prompt": "Event follow-up ready: ${context.entities.contacts.length} contacts in 3 tiers. Approve to launch campaigns?",
          "channels": ["slack", "in_app"],
          "timeout_minutes": 2880,
          "timeout_action": "fail"
        }
      },
      {
        "order": 7,
        "skill_key": "tiered-campaign-creator",
        "input_mapping": {"approved_tiers": "${outputs}"},
        "output_key": "campaigns_created",
        "on_failure": "continue"
      },
      {
        "order": 8,
        "skill_key": "executor",
        "input_mapping": {"campaigns": "${outputs.crm_updates}"},
        "output_key": "sequences_deployed",
        "on_failure": "continue"
      }
    ]
  }'::jsonb,
  '# Event Follow-Up Sequence

Turn conference contacts into qualified pipeline.

## Tier Definitions
- Hot: Had meaningful conversation, expressed interest
- Warm: Brief interaction, exchanged cards
- Cold: Badge scan only, no conversation

## Timeline Best Practices
- Hot: Follow-up within 24 hours
- Warm: Follow-up within 48 hours
- Cold: Follow-up within 1 week

## Personalization Elements
- Reference specific conversation topic
- Mention shared event experience
- Include relevant content/case study',
  true
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Add comments for documentation
-- =============================================================================

COMMENT ON TABLE platform_skills IS
'Platform skills include agent-sequence category for multi-step orchestrated workflows following Context Engineering principles.';
