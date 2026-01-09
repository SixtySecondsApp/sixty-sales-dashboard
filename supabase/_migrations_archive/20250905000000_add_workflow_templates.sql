-- Add 10 High-Value Workflow Templates for Common Use Cases
-- 4 Basic, 4 Intermediate, 2 Advanced Complexity

-- Clear existing templates to avoid duplicates
DELETE FROM workflow_templates WHERE created_by IS NULL;

-- BASIC COMPLEXITY TEMPLATES (4)

-- 1. Instant Follow-up for New Leads
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Instant Lead Welcome',
  'Automatically create a welcome task when a new lead enters your pipeline. Never miss the critical first touch point.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "New Deal Created", "type": "deal_created", "iconName": "Database", "description": "When a new deal is added"}},
      {"id": "action_1", "type": "action", "position": {"x": 400, "y": 100}, "data": {"label": "Create Welcome Task", "type": "create_task", "iconName": "CheckSquare", "description": "Reach out within 1 hour"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "action_1"}
    ]
  }',
  'deal_created',
  '{}',
  'create_task',
  '{
    "task_title": "🎯 Welcome {{deal_name}} - First Contact",
    "task_description": "Make first contact with the new lead. Call or email to introduce yourself and understand their needs.",
    "due_in_hours": 1,
    "priority": "high"
  }',
  'easy',
  2,
  ARRAY['sales', 'lead-management', 'quick-response', 'onboarding'],
  true
);

-- 2. Meeting Follow-up Automation
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Post-Meeting Action Items',
  'Create follow-up tasks automatically after logging a meeting. Ensure consistent post-meeting execution.',
  'productivity',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Meeting Logged", "type": "activity_created", "iconName": "Activity", "description": "When meeting activity created"}},
      {"id": "action_1", "type": "action", "position": {"x": 400, "y": 100}, "data": {"label": "Create Follow-up Task", "type": "create_task", "iconName": "CheckSquare", "description": "Send meeting notes"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "action_1"}
    ]
  }',
  'activity_created',
  '{"activity_type": "meeting"}',
  'create_task',
  '{
    "task_title": "📧 Send Meeting Follow-up to {{contact_name}}",
    "task_description": "Send meeting summary, action items, and next steps. Include any promised resources or documentation.",
    "due_in_days": 1,
    "priority": "high"
  }',
  'easy',
  2,
  ARRAY['productivity', 'meetings', 'follow-up', 'communication'],
  true
);

-- 3. Deal Won Celebration
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Deal Won Notification',
  'Celebrate wins instantly! Send team notifications when deals are marked as won.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Deal Won", "type": "stage_changed", "iconName": "Target", "description": "When deal moves to Signed"}},
      {"id": "action_1", "type": "action", "position": {"x": 400, "y": 100}, "data": {"label": "Celebrate Win", "type": "send_notification", "iconName": "Bell", "description": "Notify team"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "action_1"}
    ]
  }',
  'stage_changed',
  '{"stage": "Signed"}',
  'send_notification',
  '{
    "message": "🎉 DEAL WON! {{deal_name}} - {{deal_value}} | Congrats team!",
    "urgency": "medium",
    "notify_team": true,
    "celebrate": true
  }',
  'easy',
  1,
  ARRAY['sales', 'notifications', 'team-morale', 'celebrations'],
  true
);

-- 4. Stale Deal Alert
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Stale Opportunity Alert',
  'Get alerted when deals in Opportunity stage haven''t been touched in 7 days. Prevent deals from going cold.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "No Activity", "type": "no_activity", "iconName": "Clock", "description": "7 days without activity"}},
      {"id": "action_1", "type": "action", "position": {"x": 400, "y": 100}, "data": {"label": "Create Revival Task", "type": "create_task", "iconName": "CheckSquare", "description": "Re-engage prospect"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "action_1"}
    ]
  }',
  'no_activity',
  '{"stage": "Opportunity", "days_inactive": 7}',
  'create_task',
  '{
    "task_title": "🔥 URGENT: Re-engage {{deal_name}} - Going Cold",
    "task_description": "This opportunity has been inactive for 7 days. Call or email immediately to re-engage and understand any blockers.",
    "due_in_hours": 4,
    "priority": "high"
  }',
  'easy',
  2,
  ARRAY['sales', 'pipeline-hygiene', 'follow-up', 'deal-recovery'],
  true
);

-- INTERMEDIATE COMPLEXITY TEMPLATES (4)

-- 5. Proposal Follow-up Sequence
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Smart Proposal Follow-up',
  'Multi-touch follow-up sequence after sending proposals. Day 3, 7, and 14 touchpoints to maximize close rates.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 150}, "data": {"label": "Proposal Sent", "type": "activity_created", "iconName": "Mail", "description": "When proposal activity logged"}},
      {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 150}, "data": {"label": "Check Value", "condition": "deal_value > 10000", "description": "High-value deals"}},
      {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Day 3 Follow-up", "type": "create_task", "iconName": "CheckSquare", "description": "First check-in"}},
      {"id": "action_2", "type": "action", "position": {"x": 500, "y": 200}, "data": {"label": "Day 7 Follow-up", "type": "create_task", "iconName": "CheckSquare", "description": "Second touch"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "condition_1"},
      {"id": "e2", "source": "condition_1", "target": "action_1", "label": "Yes"},
      {"id": "e3", "source": "condition_1", "target": "action_2", "label": "No"}
    ]
  }',
  'activity_created',
  '{"activity_type": "proposal"}',
  'create_sequence',
  '{
    "sequence_name": "Proposal Follow-up Sequence",
    "steps": [
      {"delay_days": 3, "action": "create_task", "title": "📞 Proposal Check-in Call", "priority": "high"},
      {"delay_days": 7, "action": "create_task", "title": "✉️ Value Reminder Email", "priority": "medium"},
      {"delay_days": 14, "action": "create_task", "title": "🎯 Final Decision Call", "priority": "high"}
    ]
  }',
  'medium',
  5,
  ARRAY['sales', 'proposals', 'follow-up', 'sequences', 'conversion'],
  true
);

-- 6. Intelligent Lead Scoring
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Lead Scoring & Routing',
  'Score leads based on engagement and route high-value leads to senior reps automatically.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 150}, "data": {"label": "Activity Logged", "type": "activity_created", "iconName": "Activity"}},
      {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "Email Opened", "condition": "activity_type = email_opened"}},
      {"id": "condition_2", "type": "condition", "position": {"x": 300, "y": 200}, "data": {"label": "Meeting Booked", "condition": "activity_type = meeting"}},
      {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Increase Score", "type": "update_field", "iconName": "TrendingUp"}},
      {"id": "action_2", "type": "action", "position": {"x": 500, "y": 200}, "data": {"label": "Assign Senior Rep", "type": "assign_owner", "iconName": "User"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "condition_1"},
      {"id": "e2", "source": "trigger_1", "target": "condition_2"},
      {"id": "e3", "source": "condition_1", "target": "action_1"},
      {"id": "e4", "source": "condition_2", "target": "action_2"}
    ]
  }',
  'activity_created',
  '{}',
  'update_field',
  '{
    "scoring_rules": {
      "email_opened": 5,
      "link_clicked": 10,
      "meeting_booked": 25,
      "proposal_viewed": 20
    },
    "routing_threshold": 50,
    "assign_to_senior": true
  }',
  'medium',
  7,
  ARRAY['sales', 'lead-scoring', 'automation', 'routing', 'qualification'],
  true
);

-- 7. Customer Success Handoff
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Sales to Success Handoff',
  'Smooth handoff from Sales to Customer Success when deals close. Creates onboarding tasks and notifications.',
  'customer_success',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 150}, "data": {"label": "Deal Won", "type": "stage_changed", "iconName": "Target"}},
      {"id": "action_1", "type": "action", "position": {"x": 350, "y": 100}, "data": {"label": "Notify CS Team", "type": "send_notification", "iconName": "Bell"}},
      {"id": "action_2", "type": "action", "position": {"x": 350, "y": 200}, "data": {"label": "Create Onboarding", "type": "create_task", "iconName": "CheckSquare"}},
      {"id": "action_3", "type": "action", "position": {"x": 350, "y": 300}, "data": {"label": "Schedule Kickoff", "type": "create_activity", "iconName": "Calendar"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "action_1"},
      {"id": "e2", "source": "trigger_1", "target": "action_2"},
      {"id": "e3", "source": "trigger_1", "target": "action_3"}
    ]
  }',
  'stage_changed',
  '{"stage": "Signed"}',
  'create_multiple',
  '{
    "actions": [
      {"type": "notification", "message": "New customer ready for onboarding: {{deal_name}}", "to": "cs_team"},
      {"type": "task", "title": "Onboarding Checklist for {{deal_name}}", "assignee": "cs_manager", "due_days": 1},
      {"type": "meeting", "title": "Kickoff Call with {{contact_name}}", "duration": 60, "due_days": 3}
    ]
  }',
  'medium',
  6,
  ARRAY['customer-success', 'onboarding', 'handoff', 'collaboration'],
  true
);

-- 8. Re-engagement Campaign
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Lost Deal Win-back',
  'Automated re-engagement for lost deals after 90 days. Many lost deals can be won with proper nurturing.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 150}, "data": {"label": "90 Days Lost", "type": "time_based", "iconName": "Clock"}},
      {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 150}, "data": {"label": "Lost Reason", "condition": "lost_reason != competitor"}},
      {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Re-engage Email", "type": "create_task", "iconName": "Mail"}},
      {"id": "action_2", "type": "action", "position": {"x": 500, "y": 200}, "data": {"label": "New Opportunity", "type": "create_deal", "iconName": "Database"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "condition_1"},
      {"id": "e2", "source": "condition_1", "target": "action_1"},
      {"id": "e3", "source": "action_1", "target": "action_2", "label": "If responded"}
    ]
  }',
  'time_based',
  '{"days_since_lost": 90, "stage": "Lost"}',
  'create_task',
  '{
    "task_title": "🔄 Win-back Outreach: {{deal_name}}",
    "task_description": "Reach out with new offerings, check if their situation has changed. Reference: {{lost_reason}}",
    "campaign_type": "win_back",
    "create_new_opportunity_on_response": true
  }',
  'medium',
  8,
  ARRAY['sales', 'win-back', 're-engagement', 'lost-deals', 'nurturing'],
  true
);

-- ADVANCED COMPLEXITY TEMPLATES (2)

-- 9. Deal Velocity Optimizer
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'Deal Velocity Optimizer',
  'Complex workflow that monitors deal progression speed and takes action to accelerate stuck deals through multiple strategies.',
  'sales',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 50, "y": 200}, "data": {"label": "Daily Check", "type": "scheduled", "iconName": "Clock"}},
      {"id": "condition_1", "type": "condition", "position": {"x": 200, "y": 100}, "data": {"label": "SQL > 14 days", "condition": "stage = SQL AND days_in_stage > 14"}},
      {"id": "condition_2", "type": "condition", "position": {"x": 200, "y": 200}, "data": {"label": "Opp > 21 days", "condition": "stage = Opportunity AND days_in_stage > 21"}},
      {"id": "condition_3", "type": "condition", "position": {"x": 200, "y": 300}, "data": {"label": "Verbal > 7 days", "condition": "stage = Verbal AND days_in_stage > 7"}},
      {"id": "condition_4", "type": "condition", "position": {"x": 400, "y": 150}, "data": {"label": "High Value?", "condition": "deal_value > 25000"}},
      {"id": "action_1", "type": "action", "position": {"x": 600, "y": 50}, "data": {"label": "Escalate to Manager", "type": "send_notification", "iconName": "AlertTriangle"}},
      {"id": "action_2", "type": "action", "position": {"x": 600, "y": 150}, "data": {"label": "Create Acceleration Plan", "type": "create_task", "iconName": "Zap"}},
      {"id": "action_3", "type": "action", "position": {"x": 600, "y": 250}, "data": {"label": "Book Strategy Call", "type": "create_activity", "iconName": "Phone"}},
      {"id": "action_4", "type": "action", "position": {"x": 600, "y": 350}, "data": {"label": "Update Forecast", "type": "update_field", "iconName": "TrendingDown"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "condition_1"},
      {"id": "e2", "source": "trigger_1", "target": "condition_2"},
      {"id": "e3", "source": "trigger_1", "target": "condition_3"},
      {"id": "e4", "source": "condition_1", "target": "condition_4"},
      {"id": "e5", "source": "condition_2", "target": "condition_4"},
      {"id": "e6", "source": "condition_3", "target": "action_3"},
      {"id": "e7", "source": "condition_4", "target": "action_1", "label": "Yes"},
      {"id": "e8", "source": "condition_4", "target": "action_2", "label": "No"},
      {"id": "e9", "source": "action_2", "target": "action_4"}
    ]
  }',
  'scheduled',
  '{"frequency": "daily", "time": "09:00"}',
  'complex_automation',
  '{
    "velocity_targets": {
      "SQL_to_Opportunity": 14,
      "Opportunity_to_Verbal": 21,
      "Verbal_to_Signed": 7
    },
    "acceleration_strategies": {
      "stuck_SQL": ["qualify_harder", "book_discovery_call", "send_case_study"],
      "stuck_Opportunity": ["executive_intro", "ROI_analysis", "competitor_comparison"],
      "stuck_Verbal": ["contract_review", "legal_fast_track", "incentive_offer"]
    },
    "escalation_rules": {
      "high_value_stuck": "notify_manager",
      "multiple_stuck": "strategy_session",
      "at_risk": "intervention_required"
    }
  }',
  'hard',
  15,
  ARRAY['sales', 'velocity', 'optimization', 'advanced', 'pipeline-acceleration', 'forecasting'],
  true
);

-- 10. Revenue Operations Command Center
INSERT INTO workflow_templates (
  name, 
  description, 
  category, 
  canvas_data,
  trigger_type, 
  trigger_conditions, 
  action_type, 
  action_config,
  difficulty_level, 
  estimated_setup_time, 
  tags, 
  is_public
) VALUES (
  'RevOps Command Center',
  'Enterprise-grade workflow orchestrating multiple teams, tracking SLAs, and ensuring consistent revenue operations across the entire customer lifecycle.',
  'revenue_operations',
  '{
    "nodes": [
      {"id": "trigger_1", "type": "trigger", "position": {"x": 50, "y": 300}, "data": {"label": "Any Stage Change", "type": "stage_changed", "iconName": "Target"}},
      {"id": "router_1", "type": "router", "position": {"x": 200, "y": 300}, "data": {"label": "Stage Router", "description": "Route by stage"}},
      {"id": "condition_1", "type": "condition", "position": {"x": 400, "y": 100}, "data": {"label": "New SQL", "condition": "new_stage = SQL"}},
      {"id": "condition_2", "type": "condition", "position": {"x": 400, "y": 200}, "data": {"label": "New Opportunity", "condition": "new_stage = Opportunity"}},
      {"id": "condition_3", "type": "condition", "position": {"x": 400, "y": 300}, "data": {"label": "New Verbal", "condition": "new_stage = Verbal"}},
      {"id": "condition_4", "type": "condition", "position": {"x": 400, "y": 400}, "data": {"label": "New Signed", "condition": "new_stage = Signed"}},
      {"id": "condition_5", "type": "condition", "position": {"x": 400, "y": 500}, "data": {"label": "Lost Deal", "condition": "new_stage = Lost"}},
      {"id": "sla_1", "type": "sla_timer", "position": {"x": 600, "y": 100}, "data": {"label": "SQL SLA", "timer": "2 hours"}},
      {"id": "sla_2", "type": "sla_timer", "position": {"x": 600, "y": 200}, "data": {"label": "Proposal SLA", "timer": "24 hours"}},
      {"id": "action_1", "type": "action", "position": {"x": 800, "y": 100}, "data": {"label": "SDR Handoff", "type": "multi_action", "iconName": "Users"}},
      {"id": "action_2", "type": "action", "position": {"x": 800, "y": 200}, "data": {"label": "AE Actions", "type": "multi_action", "iconName": "Briefcase"}},
      {"id": "action_3", "type": "action", "position": {"x": 800, "y": 300}, "data": {"label": "Deal Desk", "type": "multi_action", "iconName": "FileText"}},
      {"id": "action_4", "type": "action", "position": {"x": 800, "y": 400}, "data": {"label": "CS Handoff", "type": "multi_action", "iconName": "Heart"}},
      {"id": "action_5", "type": "action", "position": {"x": 800, "y": 500}, "data": {"label": "Loss Analysis", "type": "multi_action", "iconName": "TrendingDown"}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger_1", "target": "router_1"},
      {"id": "e2", "source": "router_1", "target": "condition_1"},
      {"id": "e3", "source": "router_1", "target": "condition_2"},
      {"id": "e4", "source": "router_1", "target": "condition_3"},
      {"id": "e5", "source": "router_1", "target": "condition_4"},
      {"id": "e6", "source": "router_1", "target": "condition_5"},
      {"id": "e7", "source": "condition_1", "target": "sla_1"},
      {"id": "e8", "source": "condition_2", "target": "sla_2"},
      {"id": "e9", "source": "sla_1", "target": "action_1"},
      {"id": "e10", "source": "sla_2", "target": "action_2"},
      {"id": "e11", "source": "condition_3", "target": "action_3"},
      {"id": "e12", "source": "condition_4", "target": "action_4"},
      {"id": "e13", "source": "condition_5", "target": "action_5"}
    ]
  }',
  'stage_changed',
  '{}',
  'revenue_orchestration',
  '{
    "orchestration_rules": {
      "SQL": {
        "sla_hours": 2,
        "actions": [
          {"type": "assign_adr", "auto_assign": true},
          {"type": "create_task", "title": "Qualify lead within 2 hours", "priority": "high"},
          {"type": "send_slack", "channel": "#new-leads", "message": "New SQL: {{deal_name}}"},
          {"type": "update_salesforce", "sync": true}
        ]
      },
      "Opportunity": {
        "sla_hours": 24,
        "actions": [
          {"type": "create_task", "title": "Send proposal within 24 hours", "priority": "high"},
          {"type": "notify_manager", "if_value_above": 50000},
          {"type": "book_technical_resource", "if_technical": true},
          {"type": "create_mutual_action_plan", "template": "enterprise"}
        ]
      },
      "Verbal": {
        "sla_hours": 48,
        "actions": [
          {"type": "engage_deal_desk", "priority": "high"},
          {"type": "legal_review", "if_custom_terms": true},
          {"type": "create_task", "title": "Send contract", "priority": "high"},
          {"type": "book_signature_call", "delay_days": 2}
        ]
      },
      "Signed": {
        "sla_hours": 1,
        "actions": [
          {"type": "celebrate", "notify_all": true},
          {"type": "create_onboarding_project", "in_tool": "asana"},
          {"type": "assign_csm", "based_on": "territory"},
          {"type": "schedule_kickoff", "within_days": 3},
          {"type": "send_welcome_package", "email_template": "enterprise_welcome"},
          {"type": "update_revenue_forecast", "immediate": true}
        ]
      },
      "Lost": {
        "sla_hours": 24,
        "actions": [
          {"type": "loss_analysis_form", "required": true},
          {"type": "notify_manager", "include_reason": true},
          {"type": "update_competitor_intel", "if_lost_to_competitor": true},
          {"type": "schedule_nurture", "delay_days": 90},
          {"type": "request_feedback", "delay_days": 7}
        ]
      }
    },
    "sla_escalation": {
      "missed_sla_action": "escalate_to_manager",
      "notification_before_sla": 30,
      "track_sla_metrics": true
    },
    "reporting": {
      "weekly_pipeline_review": true,
      "conversion_metrics": true,
      "velocity_tracking": true,
      "team_performance": true
    }
  }',
  'hard',
  20,
  ARRAY['revenue-operations', 'enterprise', 'orchestration', 'sla', 'advanced', 'multi-team', 'lifecycle'],
  true
);

-- Update template statistics for better sorting
UPDATE workflow_templates 
SET 
  popularity = CASE 
    WHEN name = 'Instant Lead Welcome' THEN 95
    WHEN name = 'Post-Meeting Action Items' THEN 92
    WHEN name = 'Deal Won Notification' THEN 88
    WHEN name = 'Stale Opportunity Alert' THEN 90
    WHEN name = 'Smart Proposal Follow-up' THEN 93
    WHEN name = 'Lead Scoring & Routing' THEN 87
    WHEN name = 'Sales to Success Handoff' THEN 85
    WHEN name = 'Lost Deal Win-back' THEN 82
    WHEN name = 'Deal Velocity Optimizer' THEN 78
    WHEN name = 'RevOps Command Center' THEN 75
    ELSE popularity
  END,
  rating_avg = CASE 
    WHEN difficulty_level = 'easy' THEN 4.7
    WHEN difficulty_level = 'medium' THEN 4.5
    WHEN difficulty_level = 'hard' THEN 4.3
    ELSE 4.0
  END,
  rating_count = CASE 
    WHEN difficulty_level = 'easy' THEN 250 + (RANDOM() * 100)::INT
    WHEN difficulty_level = 'medium' THEN 150 + (RANDOM() * 75)::INT
    WHEN difficulty_level = 'hard' THEN 50 + (RANDOM() * 50)::INT
    ELSE 10
  END
WHERE created_by IS NULL;

-- Add helpful icons and colors for visual distinction
UPDATE workflow_templates 
SET 
  icon_name = CASE 
    WHEN category = 'sales' THEN 'Target'
    WHEN category = 'productivity' THEN 'Zap'
    WHEN category = 'customer_success' THEN 'Heart'
    WHEN category = 'revenue_operations' THEN 'TrendingUp'
    ELSE 'Workflow'
  END,
  color = CASE 
    WHEN difficulty_level = 'easy' THEN 'green'
    WHEN difficulty_level = 'medium' THEN 'blue'
    WHEN difficulty_level = 'hard' THEN 'purple'
    ELSE 'gray'
  END
WHERE created_by IS NULL;

-- Create indexes for better performance when filtering templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_difficulty ON workflow_templates(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_popularity ON workflow_templates(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category_public ON workflow_templates(category, is_public);

-- Add a comment explaining the templates
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates with 10 high-value use cases: 4 basic (instant follow-ups, notifications), 4 intermediate (sequences, scoring, handoffs), and 2 advanced (velocity optimization, revenue orchestration)';