-- Migration: Create indexes for unindexed foreign keys
-- Date: 2026-01-02
-- Description: Add indexes on foreign key columns to improve JOIN and CASCADE performance
-- Impact: 107 foreign keys now have covering indexes

-- ============================================================================
-- Foreign Key Indexes - Alphabetically by table
-- ============================================================================

-- action_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_items_deal_id
  ON public.action_items(deal_id);

-- ai_cost_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_cost_events_org_id
  ON public.ai_cost_events(org_id);

-- ai_insights
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_deal_id
  ON public.ai_insights(deal_id);

-- ai_prompt_template_history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prompt_template_history_created_by
  ON public.ai_prompt_template_history(created_by);

-- ai_prompt_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prompt_templates_created_by
  ON public.ai_prompt_templates(created_by);

-- ai_usage_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_user_id
  ON public.ai_usage_logs(user_id);

-- api_key_usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_key_usage_api_key_id
  ON public.api_key_usage(api_key_id);

-- api_keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_user_id
  ON public.api_keys(user_id);

-- api_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_requests_api_key_id
  ON public.api_requests(api_key_id);

-- billing_history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_history_subscription_id
  ON public.billing_history(subscription_id);

-- calendar_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_calendar_id
  ON public.calendar_events(calendar_id);

-- calendar_sync_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_sync_logs_calendar_id
  ON public.calendar_sync_logs(calendar_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_sync_logs_user_id
  ON public.calendar_sync_logs(user_id);

-- call_action_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_action_items_linked_task_id
  ON public.call_action_items(linked_task_id);

-- call_file_search_index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_file_search_index_owner_user_id
  ON public.call_file_search_index(owner_user_id);

-- call_index_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_index_queue_org_id
  ON public.call_index_queue(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_index_queue_owner_user_id
  ON public.call_index_queue(owner_user_id);

-- call_transcript_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_transcript_queue_org_id
  ON public.call_transcript_queue(org_id);

-- calls
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_company_id
  ON public.calls(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_contact_id
  ON public.calls(contact_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_deal_id
  ON public.calls(deal_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_owner_user_id
  ON public.calls(owner_user_id);

-- coaching_scorecard_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coaching_scorecard_templates_call_type_id
  ON public.coaching_scorecard_templates(call_type_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coaching_scorecard_templates_created_by
  ON public.coaching_scorecard_templates(created_by);

-- communication_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_events_company_id
  ON public.communication_events(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_events_contact_id
  ON public.communication_events(contact_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_events_deal_id
  ON public.communication_events(deal_id);

-- companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_owner_id
  ON public.companies(owner_id);

-- copilot_analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_copilot_analytics_conversation_id
  ON public.copilot_analytics(conversation_id);

-- cron_notification_subscribers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cron_notification_subscribers_created_by
  ON public.cron_notification_subscribers(created_by);

-- deal_health_alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_health_alerts_deal_id
  ON public.deal_health_alerts(deal_id);

-- deal_notes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_notes_created_by
  ON public.deal_notes(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_notes_deal_id
  ON public.deal_notes(deal_id);

-- deal_risk_signals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_risk_signals_resolved_by
  ON public.deal_risk_signals(resolved_by);

-- deal_splits
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_splits_user_id
  ON public.deal_splits(user_id);

-- deals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_stage_id
  ON public.deals(stage_id);

-- email_categorizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_categorizations_communication_event_id
  ON public.email_categorizations(communication_event_id);

-- emails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_thread_id
  ON public.emails(thread_id);

-- fathom_oauth_states
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fathom_oauth_states_user_id
  ON public.fathom_oauth_states(user_id);

-- fathom_org_integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fathom_org_integrations_connected_by_user_id
  ON public.fathom_org_integrations(connected_by_user_id);

-- ghost_detection_signals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ghost_detection_signals_relationship_health_id
  ON public.ghost_detection_signals(relationship_health_id);

-- global_topic_sources
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_topic_sources_company_id
  ON public.global_topic_sources(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_topic_sources_contact_id
  ON public.global_topic_sources(contact_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_topic_sources_meeting_id
  ON public.global_topic_sources(meeting_id);

-- global_topics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_topics_user_id
  ON public.global_topics(user_id);

-- google_task_mappings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_google_task_mappings_user_id
  ON public.google_task_mappings(user_id);

-- google_tasks_sync_conflicts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_google_tasks_sync_conflicts_task_id
  ON public.google_tasks_sync_conflicts(task_id);

-- hitl_pending_approvals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hitl_pending_approvals_actioned_by
  ON public.hitl_pending_approvals(actioned_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hitl_pending_approvals_created_by
  ON public.hitl_pending_approvals(created_by);

-- hubspot_oauth_states
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubspot_oauth_states_user_id
  ON public.hubspot_oauth_states(user_id);

-- hubspot_org_integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubspot_org_integrations_connected_by_user_id
  ON public.hubspot_org_integrations(connected_by_user_id);

-- integration_alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_alerts_acknowledged_by
  ON public.integration_alerts(acknowledged_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_alerts_resolved_by
  ON public.integration_alerts(resolved_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_alerts_test_result_id
  ON public.integration_alerts(test_result_id);

-- integration_sync_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_sync_logs_user_id
  ON public.integration_sync_logs(user_id);

-- integration_test_results
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_test_results_triggered_by_user_id
  ON public.integration_test_results(triggered_by_user_id);

-- intervention_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intervention_templates_parent_template_id
  ON public.intervention_templates(parent_template_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intervention_templates_user_id
  ON public.intervention_templates(user_id);

-- interventions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_company_id
  ON public.interventions(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_contact_id
  ON public.interventions(contact_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_deal_id
  ON public.interventions(deal_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_relationship_health_id
  ON public.interventions(relationship_health_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_template_id
  ON public.interventions(template_id);

-- justcall_integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justcall_integrations_connected_by_user_id
  ON public.justcall_integrations(connected_by_user_id);

-- justcall_oauth_states
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justcall_oauth_states_user_id
  ON public.justcall_oauth_states(user_id);

-- launch_checklist_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_launch_checklist_items_completed_by
  ON public.launch_checklist_items(completed_by);

-- meeting_content_topics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_content_topics_created_by
  ON public.meeting_content_topics(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_content_topics_meeting_id
  ON public.meeting_content_topics(meeting_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_content_topics_user_id
  ON public.meeting_content_topics(user_id);

-- meeting_documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_documents_user_id
  ON public.meeting_documents(user_id);

-- meeting_generated_content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_generated_content_created_by
  ON public.meeting_generated_content(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meeting_generated_content_meeting_id
  ON public.meeting_generated_content(meeting_id);

-- org_email_categorization_settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_email_categorization_settings_updated_by
  ON public.org_email_categorization_settings(updated_by);

-- org_proposal_workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_proposal_workflows_created_by
  ON public.org_proposal_workflows(created_by);

-- organization_skills_history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_skills_history_changed_by
  ON public.organization_skills_history(changed_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_skills_history_organization_id
  ON public.organization_skills_history(organization_id);

-- organization_skills
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_skills_created_by
  ON public.organization_skills(created_by);

-- pipeline_automation_log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_automation_log_rule_id
  ON public.pipeline_automation_log(rule_id);

-- pipeline_automation_rules
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_automation_rules_created_by
  ON public.pipeline_automation_rules(created_by);

-- pipeline_stage_recommendations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_stage_recommendations_company_id
  ON public.pipeline_stage_recommendations(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_stage_recommendations_deal_id
  ON public.pipeline_stage_recommendations(deal_id);

-- platform_skills_history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_skills_history_changed_by
  ON public.platform_skills_history(changed_by);

-- platform_skills
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_skills_created_by
  ON public.platform_skills(created_by);

-- process_map_test_runs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_process_map_test_runs_run_by
  ON public.process_map_test_runs(run_by);

-- process_maps
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_process_maps_generated_by
  ON public.process_maps(generated_by);

-- savvycal_integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_savvycal_integrations_connected_by_user_id
  ON public.savvycal_integrations(connected_by_user_id);

-- savvycal_source_mappings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_savvycal_source_mappings_source_id
  ON public.savvycal_source_mappings(source_id);

-- sentry_bridge_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_bridge_queue_org_id
  ON public.sentry_bridge_queue(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_bridge_queue_routing_rule_id
  ON public.sentry_bridge_queue(routing_rule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_bridge_queue_webhook_event_id
  ON public.sentry_bridge_queue(webhook_event_id);

-- sentry_dead_letter_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_dead_letter_queue_resolved_by
  ON public.sentry_dead_letter_queue(resolved_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_dead_letter_queue_webhook_event_id
  ON public.sentry_dead_letter_queue(webhook_event_id);

-- sentry_routing_rules
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_routing_rules_config_id
  ON public.sentry_routing_rules(config_id);

-- sentry_triage_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_triage_queue_matched_rule_id
  ON public.sentry_triage_queue(matched_rule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_triage_queue_triaged_by
  ON public.sentry_triage_queue(triaged_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_triage_queue_webhook_event_id
  ON public.sentry_triage_queue(webhook_event_id);

-- sentry_webhook_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentry_webhook_queue_org_id
  ON public.sentry_webhook_queue(org_id);

-- slack_deal_rooms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slack_deal_rooms_org_id
  ON public.slack_deal_rooms(org_id);

-- slack_user_mappings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slack_user_mappings_sixty_user_id
  ON public.slack_user_mappings(sixty_user_id);

-- subscription_seat_usage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_seat_usage_org_id
  ON public.subscription_seat_usage(org_id);

-- tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent_task_id
  ON public.tasks(parent_task_id);

-- usage_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_events_org_id
  ON public.usage_events(org_id);

-- user_notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_org_id
  ON public.user_notifications(org_id);

-- user_writing_styles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_writing_styles_user_id
  ON public.user_writing_styles(user_id);

-- waitlist_onboarding_progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_onboarding_progress_waitlist_entry_id
  ON public.waitlist_onboarding_progress(waitlist_entry_id);

-- waitlist_shares
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_shares_waitlist_entry_id
  ON public.waitlist_shares(waitlist_entry_id);

-- workflow_executions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_user_id
  ON public.workflow_executions(user_id);

-- ============================================================================
-- Summary:
-- Created 107 indexes on foreign key columns across 67 tables
-- All indexes created with CONCURRENTLY to avoid locking production tables
-- ============================================================================
