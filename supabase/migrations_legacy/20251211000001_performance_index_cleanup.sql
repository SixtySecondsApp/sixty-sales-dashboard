-- Migration: Performance Index Cleanup
-- Date: 2025-12-11
-- Purpose: Drop 427 unused indexes, add 90 missing FK indexes, drop 2 backup tables
-- Stats period: Since 2025-11-21 (3 weeks of usage data)
-- Expected savings: ~8.9 MB of index storage

-- ============================================================================
-- PART 1: DROP UNUSED REGULAR INDEXES (427 indexes, ~8.9 MB)
-- These indexes have had 0 scans since stats were reset on 2025-11-21
-- ============================================================================

-- action_items table
DROP INDEX IF EXISTS idx_action_items_completed;
DROP INDEX IF EXISTS idx_action_items_deal_id;
DROP INDEX IF EXISTS idx_action_items_due_date;

-- activities table
DROP INDEX IF EXISTS idx_activities_clerk_org_id;
DROP INDEX IF EXISTS idx_activities_contact_identifier;
DROP INDEX IF EXISTS idx_activities_is_processed;
DROP INDEX IF EXISTS idx_activities_is_rebooking;
DROP INDEX IF EXISTS idx_activities_is_self_generated;
DROP INDEX IF EXISTS idx_activities_is_split;
DROP INDEX IF EXISTS idx_activities_next_actions_generated;
DROP INDEX IF EXISTS idx_activities_outbound_type;
DROP INDEX IF EXISTS idx_activities_proposal_date;
DROP INDEX IF EXISTS idx_activities_sale_date;
DROP INDEX IF EXISTS idx_activities_savvycal_booking_id;
DROP INDEX IF EXISTS idx_activities_savvycal_link_id;
DROP INDEX IF EXISTS idx_activities_type_deal;

-- ai_cost_events table
DROP INDEX IF EXISTS idx_ai_cost_events_created_at;
DROP INDEX IF EXISTS idx_ai_cost_events_feature;
DROP INDEX IF EXISTS idx_ai_cost_events_org_date;
DROP INDEX IF EXISTS idx_ai_cost_events_org_id;
DROP INDEX IF EXISTS idx_ai_cost_events_provider_model;

-- ai_insights table
DROP INDEX IF EXISTS idx_ai_insights_created_at;
DROP INDEX IF EXISTS idx_ai_insights_deal_id;
DROP INDEX IF EXISTS idx_ai_insights_insight_type;
DROP INDEX IF EXISTS idx_ai_insights_priority;

-- ai_prompt_templates table
DROP INDEX IF EXISTS idx_ai_prompt_templates_is_public;
DROP INDEX IF EXISTS idx_ai_prompt_templates_user_id;

-- ai_usage_logs table
DROP INDEX IF EXISTS idx_ai_usage_logs_created_at;
DROP INDEX IF EXISTS idx_ai_usage_logs_user_id;
DROP INDEX IF EXISTS idx_ai_usage_logs_workflow_id;

-- api_key_usage table
DROP INDEX IF EXISTS idx_api_key_usage_api_key_id;
DROP INDEX IF EXISTS idx_api_key_usage_created_at;

-- api_keys table
DROP INDEX IF EXISTS idx_api_keys_expires_at;
DROP INDEX IF EXISTS idx_api_keys_key_hash;
DROP INDEX IF EXISTS idx_api_keys_user_id;

-- api_requests table
DROP INDEX IF EXISTS idx_api_requests_api_key_id;
DROP INDEX IF EXISTS idx_api_requests_created_at;

-- automation_executions table
DROP INDEX IF EXISTS idx_automation_executions_executed_at;
DROP INDEX IF EXISTS idx_automation_executions_rule_id;
DROP INDEX IF EXISTS idx_automation_executions_status;

-- billing_history table
DROP INDEX IF EXISTS idx_billing_history_created_at;
DROP INDEX IF EXISTS idx_billing_history_subscription_id;

-- booking_sources table
DROP INDEX IF EXISTS idx_booking_sources_active;
DROP INDEX IF EXISTS idx_booking_sources_api_name;
DROP INDEX IF EXISTS idx_booking_sources_category;
DROP INDEX IF EXISTS idx_booking_sources_sort_order;

-- branding_settings table
DROP INDEX IF EXISTS idx_branding_settings_org_id;

-- calendar_calendars table
DROP INDEX IF EXISTS idx_calendar_calendars_timezone;

-- calendar_events table
DROP INDEX IF EXISTS idx_calendar_events_calendar_id;
DROP INDEX IF EXISTS idx_calendar_events_org_id;
DROP INDEX IF EXISTS idx_calendar_events_organizer;
DROP INDEX IF EXISTS idx_calendar_events_sync_status;

-- calendar_sync_logs table
DROP INDEX IF EXISTS idx_calendar_sync_logs_calendar_id;
DROP INDEX IF EXISTS idx_calendar_sync_logs_started_at;
DROP INDEX IF EXISTS idx_calendar_sync_logs_user_id;

-- clerk_sync_log table
DROP INDEX IF EXISTS idx_clerk_sync_log_clerk_id;
DROP INDEX IF EXISTS idx_clerk_sync_log_event_type;
DROP INDEX IF EXISTS idx_clerk_sync_log_synced_at;

-- clerk_user_mappings table
DROP INDEX IF EXISTS idx_clerk_mapping_email;
DROP INDEX IF EXISTS idx_clerk_mapping_supabase_id;

-- clients table
DROP INDEX IF EXISTS idx_clients_status;
DROP INDEX IF EXISTS idx_clients_subscription_amount;

-- communication_events table
DROP INDEX IF EXISTS idx_communication_events_ai_pending;
DROP INDEX IF EXISTS idx_communication_events_company;
DROP INDEX IF EXISTS idx_communication_events_company_date;
DROP INDEX IF EXISTS idx_communication_events_contact;
DROP INDEX IF EXISTS idx_communication_events_contact_date;
DROP INDEX IF EXISTS idx_communication_events_contact_timestamp;
DROP INDEX IF EXISTS idx_communication_events_deal;
DROP INDEX IF EXISTS idx_communication_events_deal_date;
DROP INDEX IF EXISTS idx_communication_events_deal_email;
DROP INDEX IF EXISTS idx_communication_events_direction;
DROP INDEX IF EXISTS idx_communication_events_email_sentiment;
DROP INDEX IF EXISTS idx_communication_events_external;
DROP INDEX IF EXISTS idx_communication_events_gmail_id;
DROP INDEX IF EXISTS idx_communication_events_sentiment;
DROP INDEX IF EXISTS idx_communication_events_sync_date;
DROP INDEX IF EXISTS idx_communication_events_thread;
DROP INDEX IF EXISTS idx_communication_events_timestamp;
DROP INDEX IF EXISTS idx_communication_events_type;
DROP INDEX IF EXISTS idx_communication_events_unanswered;

-- companies table
DROP INDEX IF EXISTS idx_companies_clerk_org_id;
DROP INDEX IF EXISTS idx_companies_domain;
DROP INDEX IF EXISTS idx_companies_domain_lower;
DROP INDEX IF EXISTS idx_companies_name;
DROP INDEX IF EXISTS idx_companies_owner_id;

-- company_meeting_insights table
DROP INDEX IF EXISTS idx_company_insights_company;
DROP INDEX IF EXISTS idx_company_insights_deal_probability;
DROP INDEX IF EXISTS idx_company_insights_engagement;
DROP INDEX IF EXISTS idx_company_insights_last_meeting;

-- contact_meeting_insights table
DROP INDEX IF EXISTS idx_contact_insights_engagement;
DROP INDEX IF EXISTS idx_contact_insights_last_meeting;
DROP INDEX IF EXISTS idx_contact_insights_sentiment;

-- contact_notes table
DROP INDEX IF EXISTS idx_contact_notes_contact_created;
DROP INDEX IF EXISTS idx_contact_notes_contact_id;
DROP INDEX IF EXISTS idx_contact_notes_created_at;
DROP INDEX IF EXISTS idx_contact_notes_is_pinned;
DROP INDEX IF EXISTS idx_contact_notes_tags;

-- contacts table
DROP INDEX IF EXISTS idx_contacts_clerk_org_id;
DROP INDEX IF EXISTS idx_contacts_engagement_level;
DROP INDEX IF EXISTS idx_contacts_health_score;
DROP INDEX IF EXISTS idx_contacts_last_interaction;
DROP INDEX IF EXISTS idx_contacts_meetings_count;
DROP INDEX IF EXISTS idx_contacts_owner_email;

-- content_topic_links table
DROP INDEX IF EXISTS idx_links_topic_index;

-- copilot_analytics table
DROP INDEX IF EXISTS idx_copilot_analytics_conversation_id;
DROP INDEX IF EXISTS idx_copilot_analytics_created_at;
DROP INDEX IF EXISTS idx_copilot_analytics_request_type;
DROP INDEX IF EXISTS idx_copilot_analytics_status;
DROP INDEX IF EXISTS idx_copilot_analytics_tools_used;
DROP INDEX IF EXISTS idx_copilot_analytics_user_created;

-- copilot_conversations table
DROP INDEX IF EXISTS idx_copilot_conversations_updated_at;

-- copilot_messages table
DROP INDEX IF EXISTS idx_copilot_messages_created_at;

-- cost_rates table
DROP INDEX IF EXISTS idx_cost_rates_active;

-- cron_job_logs table
DROP INDEX IF EXISTS idx_cron_job_logs_created_at;
DROP INDEX IF EXISTS idx_cron_job_logs_job_name;

-- csv_mapping_templates table
DROP INDEX IF EXISTS idx_csv_mapping_templates_last_used;

-- deal_activities table
DROP INDEX IF EXISTS idx_deal_activities_contact_email;
DROP INDEX IF EXISTS idx_deal_activities_unmatched;

-- deal_health_alerts table
DROP INDEX IF EXISTS idx_deal_health_alerts_created;
DROP INDEX IF EXISTS idx_deal_health_alerts_deal;
DROP INDEX IF EXISTS idx_deal_health_alerts_severity;
DROP INDEX IF EXISTS idx_deal_health_alerts_type;

-- deal_health_history table
DROP INDEX IF EXISTS idx_deal_health_history_snapshot;

-- deal_health_rules table
DROP INDEX IF EXISTS idx_deal_health_rules_active;
DROP INDEX IF EXISTS idx_deal_health_rules_type;

-- deal_health_scores table
DROP INDEX IF EXISTS idx_deal_health_scores_last_calculated;
DROP INDEX IF EXISTS idx_deal_health_scores_risk;
DROP INDEX IF EXISTS idx_deal_health_scores_status;
DROP INDEX IF EXISTS idx_deal_health_scores_updated;
DROP INDEX IF EXISTS idx_deal_health_scores_user_status;

-- deal_migration_reviews table
DROP INDEX IF EXISTS idx_deal_migration_reviews_status;

-- deal_notes table
DROP INDEX IF EXISTS idx_deal_notes_created_at;
DROP INDEX IF EXISTS idx_deal_notes_created_by;
DROP INDEX IF EXISTS idx_deal_notes_deal_created;
DROP INDEX IF EXISTS idx_deal_notes_deal_id;
DROP INDEX IF EXISTS idx_deal_notes_deal_pinned;
DROP INDEX IF EXISTS idx_deal_notes_is_pinned;
DROP INDEX IF EXISTS idx_deal_notes_tags;

-- deal_splits table
DROP INDEX IF EXISTS idx_deal_splits_created_at;
DROP INDEX IF EXISTS idx_deal_splits_deal_id;
DROP INDEX IF EXISTS idx_deal_splits_user_id;

-- deals table
DROP INDEX IF EXISTS idx_deals_annual_value;
DROP INDEX IF EXISTS idx_deals_clerk_org_created;
DROP INDEX IF EXISTS idx_deals_clerk_org_id;
DROP INDEX IF EXISTS idx_deals_created_at;
DROP INDEX IF EXISTS idx_deals_expected_close_date;
DROP INDEX IF EXISTS idx_deals_health_score;
DROP INDEX IF EXISTS idx_deals_momentum_score;
DROP INDEX IF EXISTS idx_deals_monthly_mrr;
DROP INDEX IF EXISTS idx_deals_one_off_revenue;
DROP INDEX IF EXISTS idx_deals_risk_level;
DROP INDEX IF EXISTS idx_deals_savvycal_booking_id;
DROP INDEX IF EXISTS idx_deals_savvycal_link_id;
DROP INDEX IF EXISTS idx_deals_stage_id;

-- email_threads table
DROP INDEX IF EXISTS idx_email_threads_last_message;

-- emails table
DROP INDEX IF EXISTS idx_emails_ai_priority;
DROP INDEX IF EXISTS idx_emails_is_read;
DROP INDEX IF EXISTS idx_emails_received_at;
DROP INDEX IF EXISTS idx_emails_thread_id;

-- execution_snapshots table
DROP INDEX IF EXISTS idx_execution_snapshots_execution;
DROP INDEX IF EXISTS idx_execution_snapshots_workflow;

-- fathom_integrations table
DROP INDEX IF EXISTS idx_fathom_integrations_fathom_user_id;

-- fathom_oauth_states table
DROP INDEX IF EXISTS idx_fathom_oauth_states_state;
DROP INDEX IF EXISTS idx_fathom_oauth_states_user_id;

-- fathom_sync_state table
DROP INDEX IF EXISTS idx_fathom_sync_state_integration_id;
DROP INDEX IF EXISTS idx_fathom_sync_state_status;

-- fathom_transcript_retry_jobs table
DROP INDEX IF EXISTS idx_transcript_retry_jobs_failed;
DROP INDEX IF EXISTS idx_transcript_retry_jobs_meeting;
DROP INDEX IF EXISTS idx_transcript_retry_jobs_pending;
DROP INDEX IF EXISTS idx_transcript_retry_jobs_user;

-- ghost_detection_signals table
DROP INDEX IF EXISTS idx_ghost_signals_detected;
DROP INDEX IF EXISTS idx_ghost_signals_relationship;
DROP INDEX IF EXISTS idx_ghost_signals_severity;
DROP INDEX IF EXISTS idx_ghost_signals_type;
DROP INDEX IF EXISTS idx_ghost_signals_unresolved;

-- global_topic_sources table
DROP INDEX IF EXISTS idx_topic_sources_company;
DROP INDEX IF EXISTS idx_topic_sources_contact;
DROP INDEX IF EXISTS idx_topic_sources_date;
DROP INDEX IF EXISTS idx_topic_sources_global_topic;
DROP INDEX IF EXISTS idx_topic_sources_meeting;
DROP INDEX IF EXISTS idx_topic_sources_meeting_date_desc;

-- global_topics table
DROP INDEX IF EXISTS idx_global_topics_last_seen;
DROP INDEX IF EXISTS idx_global_topics_relevance;
DROP INDEX IF EXISTS idx_global_topics_search;
DROP INDEX IF EXISTS idx_global_topics_source_count;
DROP INDEX IF EXISTS idx_global_topics_user_id;

-- google_calendars table
DROP INDEX IF EXISTS idx_google_calendars_integration_id;

-- google_drive_folders table
DROP INDEX IF EXISTS idx_google_drive_folders_integration_id;

-- google_email_labels table
DROP INDEX IF EXISTS idx_google_email_labels_integration_id;

-- google_integrations table
DROP INDEX IF EXISTS idx_google_integrations_email;
DROP INDEX IF EXISTS idx_google_integrations_user_id;

-- google_oauth_states table
DROP INDEX IF EXISTS idx_google_oauth_states_expires_at;
DROP INDEX IF EXISTS idx_google_oauth_states_state;

-- google_service_logs table
DROP INDEX IF EXISTS idx_google_service_logs_created_at;

-- google_task_lists table
DROP INDEX IF EXISTS idx_google_task_lists_integration_id;

-- google_task_mappings table
DROP INDEX IF EXISTS idx_google_task_mappings_google_list_id;
DROP INDEX IF EXISTS idx_google_task_mappings_google_task_id;
DROP INDEX IF EXISTS idx_google_task_mappings_google_task_user;
DROP INDEX IF EXISTS idx_google_task_mappings_task_id;
DROP INDEX IF EXISTS idx_google_task_mappings_user_id;

-- google_tasks_list_configs table
DROP INDEX IF EXISTS idx_task_configs_enabled;
DROP INDEX IF EXISTS idx_task_configs_user_id;

-- google_tasks_sync_conflicts table
DROP INDEX IF EXISTS idx_sync_conflicts_resolved;
DROP INDEX IF EXISTS idx_sync_conflicts_task_id;

-- google_tasks_sync_status table
DROP INDEX IF EXISTS idx_google_tasks_sync_status_user_id;

-- http_request_recordings table
DROP INDEX IF EXISTS idx_http_recordings_execution;

-- impersonation_logs table
DROP INDEX IF EXISTS idx_impersonation_logs_created_at;

-- internal_users table
DROP INDEX IF EXISTS idx_internal_users_email;

-- intervention_templates table
DROP INDEX IF EXISTS idx_intervention_templates_active;
DROP INDEX IF EXISTS idx_intervention_templates_context;
DROP INDEX IF EXISTS idx_intervention_templates_parent;
DROP INDEX IF EXISTS idx_intervention_templates_performance;
DROP INDEX IF EXISTS idx_intervention_templates_system;
DROP INDEX IF EXISTS idx_intervention_templates_type;
DROP INDEX IF EXISTS idx_intervention_templates_user;

-- interventions table
DROP INDEX IF EXISTS idx_interventions_company;
DROP INDEX IF EXISTS idx_interventions_contact;
DROP INDEX IF EXISTS idx_interventions_deal;
DROP INDEX IF EXISTS idx_interventions_outcome;
DROP INDEX IF EXISTS idx_interventions_pending;
DROP INDEX IF EXISTS idx_interventions_relationship;
DROP INDEX IF EXISTS idx_interventions_replied;
DROP INDEX IF EXISTS idx_interventions_sent;
DROP INDEX IF EXISTS idx_interventions_status;
DROP INDEX IF EXISTS idx_interventions_template;

-- lead_events table
DROP INDEX IF EXISTS idx_lead_events_event_type;
DROP INDEX IF EXISTS idx_lead_events_external_id;

-- lead_prep_notes table
DROP INDEX IF EXISTS idx_lead_prep_notes_auto;
DROP INDEX IF EXISTS idx_lead_prep_notes_created_at;
DROP INDEX IF EXISTS idx_lead_prep_notes_note_type;
DROP INDEX IF EXISTS idx_lead_prep_notes_pinned;

-- lead_sources table
DROP INDEX IF EXISTS idx_lead_sources_active;
DROP INDEX IF EXISTS idx_lead_sources_channel;

-- leads table
DROP INDEX IF EXISTS idx_leads_clerk_org_id;
DROP INDEX IF EXISTS idx_leads_contact_email;
DROP INDEX IF EXISTS idx_leads_domain;
DROP INDEX IF EXISTS idx_leads_enrichment_status;
DROP INDEX IF EXISTS idx_leads_prep_status;
DROP INDEX IF EXISTS idx_leads_status;
DROP INDEX IF EXISTS idx_leads_tags;

-- meeting_action_items table
DROP INDEX IF EXISTS idx_action_items_ai_generated;
DROP INDEX IF EXISTS idx_action_items_importance;
DROP INDEX IF EXISTS idx_action_items_needs_review;
DROP INDEX IF EXISTS idx_meeting_action_items_ai_analyzed;
DROP INDEX IF EXISTS idx_meeting_action_items_assignee_email;
DROP INDEX IF EXISTS idx_meeting_action_items_deadline;
DROP INDEX IF EXISTS idx_meeting_action_items_sync_status;
DROP INDEX IF EXISTS idx_meeting_action_items_task_id;

-- meeting_contacts table
DROP INDEX IF EXISTS idx_meeting_contacts_primary;

-- meeting_content_topics table
DROP INDEX IF EXISTS idx_topics_created_at;
DROP INDEX IF EXISTS idx_topics_created_by;
DROP INDEX IF EXISTS idx_topics_extraction_version;
DROP INDEX IF EXISTS idx_topics_jsonb_search;
DROP INDEX IF EXISTS idx_topics_meeting_id;
DROP INDEX IF EXISTS idx_topics_user_id;

-- meeting_documents table
DROP INDEX IF EXISTS idx_meeting_documents_meeting_id;
DROP INDEX IF EXISTS idx_meeting_documents_user_id;

-- meeting_generated_content table
DROP INDEX IF EXISTS idx_content_created_at;
DROP INDEX IF EXISTS idx_content_created_by;
DROP INDEX IF EXISTS idx_content_is_latest;
DROP INDEX IF EXISTS idx_content_meeting_id;
DROP INDEX IF EXISTS idx_content_type;
DROP INDEX IF EXISTS idx_content_version;

-- meeting_intelligence_queries table
DROP INDEX IF EXISTS idx_meeting_intelligence_queries_user_id;

-- meetings table
DROP INDEX IF EXISTS idx_meetings_clerk_org_id;
DROP INDEX IF EXISTS idx_meetings_fathom_user_id;
DROP INDEX IF EXISTS idx_meetings_invitees_type;
DROP INDEX IF EXISTS idx_meetings_language;
DROP INDEX IF EXISTS idx_meetings_next_actions_generated;
DROP INDEX IF EXISTS idx_meetings_owner_email;
DROP INDEX IF EXISTS idx_meetings_owner_user_id_meeting_start;
DROP INDEX IF EXISTS idx_meetings_sync_status;
DROP INDEX IF EXISTS idx_meetings_thumbnail_updated;
DROP INDEX IF EXISTS idx_meetings_transcript_retry;
DROP INDEX IF EXISTS idx_meetings_transcript_text_search;

-- meetings_waitlist table
DROP INDEX IF EXISTS idx_meetings_waitlist_is_seeded;
DROP INDEX IF EXISTS idx_waitlist_converted;
DROP INDEX IF EXISTS idx_waitlist_effective_position;
DROP INDEX IF EXISTS idx_waitlist_email;
DROP INDEX IF EXISTS idx_waitlist_magic_link_expiry;
DROP INDEX IF EXISTS idx_waitlist_status;
DROP INDEX IF EXISTS idx_waitlist_status_user;

-- next_action_suggestions table
DROP INDEX IF EXISTS idx_next_action_suggestions_timestamp;
DROP INDEX IF EXISTS idx_next_actions_deadline;
DROP INDEX IF EXISTS idx_next_actions_urgency_status;
DROP INDEX IF EXISTS idx_suggestions_importance;

-- node_executions table
DROP INDEX IF EXISTS idx_node_executions_execution_id;

-- node_fixtures table
DROP INDEX IF EXISTS idx_node_fixtures_workflow;

-- notification_rate_limits table
DROP INDEX IF EXISTS idx_notification_rate_limits_cleanup;

-- notifications table
DROP INDEX IF EXISTS idx_notifications_category;
DROP INDEX IF EXISTS idx_notifications_entity;
DROP INDEX IF EXISTS idx_notifications_user_unread;

-- org_file_search_stores table
DROP INDEX IF EXISTS idx_org_file_search_stores_org_id;

-- organization_feature_flags table
DROP INDEX IF EXISTS idx_org_feature_flags_key;
DROP INDEX IF EXISTS idx_org_feature_flags_org_id;

-- organization_invitations table
DROP INDEX IF EXISTS idx_organization_invitations_email;
DROP INDEX IF EXISTS idx_organization_invitations_expires_at;
DROP INDEX IF EXISTS idx_organization_invitations_org_id;
DROP INDEX IF EXISTS idx_organization_invitations_token;

-- organization_memberships table
DROP INDEX IF EXISTS idx_organization_memberships_role;

-- organization_subscriptions table
DROP INDEX IF EXISTS idx_org_subscriptions_status;
DROP INDEX IF EXISTS idx_org_subscriptions_stripe_id;
DROP INDEX IF EXISTS idx_org_subscriptions_stripe_price;

-- organization_usage table
DROP INDEX IF EXISTS idx_org_usage_org_id;

-- organizations table
DROP INDEX IF EXISTS idx_organizations_created_at;
DROP INDEX IF EXISTS idx_organizations_created_by;

-- pipeline_stage_recommendations table
DROP INDEX IF EXISTS idx_pipeline_recommendations_company;
DROP INDEX IF EXISTS idx_pipeline_recommendations_created;
DROP INDEX IF EXISTS idx_pipeline_recommendations_deal;
DROP INDEX IF EXISTS idx_pipeline_recommendations_status;

-- profiles table
DROP INDEX IF EXISTS idx_profiles_auth_provider;
DROP INDEX IF EXISTS idx_profiles_clerk_user_id;
DROP INDEX IF EXISTS idx_profiles_last_login;

-- proposal_jobs table
DROP INDEX IF EXISTS idx_proposal_jobs_pending;
DROP INDEX IF EXISTS idx_proposal_jobs_status_created;

-- proposals table
DROP INDEX IF EXISTS idx_proposals_share_token;

-- rate_limit table
DROP INDEX IF EXISTS idx_rate_limit_user_created;

-- relationship_health_history table
DROP INDEX IF EXISTS idx_relationship_history_relationship;
DROP INDEX IF EXISTS idx_relationship_history_snapshot;
DROP INDEX IF EXISTS idx_relationship_history_status;

-- relationship_health_scores table
DROP INDEX IF EXISTS idx_relationship_health_calculated;
DROP INDEX IF EXISTS idx_relationship_health_ghost_risk;
DROP INDEX IF EXISTS idx_relationship_health_scores_ghost_risk;
DROP INDEX IF EXISTS idx_relationship_health_scores_last_calculated;
DROP INDEX IF EXISTS idx_relationship_health_scores_user_status;
DROP INDEX IF EXISTS idx_relationship_health_status;

-- roadmap_suggestions table
DROP INDEX IF EXISTS idx_roadmap_suggestions_hub_sync_status;
DROP INDEX IF EXISTS idx_roadmap_suggestions_hub_task_id;
DROP INDEX IF EXISTS idx_roadmap_suggestions_ticket_id;

-- savvycal_link_mappings table
DROP INDEX IF EXISTS idx_savvycal_link_mappings_active;
DROP INDEX IF EXISTS idx_savvycal_link_mappings_link_id;

-- savvycal_source_mappings table
DROP INDEX IF EXISTS idx_savvycal_source_mappings_link_id;
DROP INDEX IF EXISTS idx_savvycal_source_mappings_meeting_link;
DROP INDEX IF EXISTS idx_savvycal_source_mappings_org_id;
DROP INDEX IF EXISTS idx_savvycal_source_mappings_private_link;
DROP INDEX IF EXISTS idx_savvycal_source_mappings_source;
DROP INDEX IF EXISTS idx_savvycal_source_mappings_source_id;

-- scenario_fixtures table
DROP INDEX IF EXISTS idx_scenario_fixtures_workflow;

-- sentiment_alerts table
DROP INDEX IF EXISTS idx_sentiment_alerts_created_at;
DROP INDEX IF EXISTS idx_sentiment_alerts_is_read;

-- slack_channels table
DROP INDEX IF EXISTS idx_slack_channels_channel_id;
DROP INDEX IF EXISTS idx_slack_channels_integration_id;

-- slack_deal_rooms table
DROP INDEX IF EXISTS idx_slack_deal_rooms_active;
DROP INDEX IF EXISTS idx_slack_deal_rooms_channel_id;
DROP INDEX IF EXISTS idx_slack_deal_rooms_deal_id;
DROP INDEX IF EXISTS idx_slack_deal_rooms_org_id;

-- slack_integrations table
DROP INDEX IF EXISTS idx_slack_integrations_team_id;
DROP INDEX IF EXISTS idx_slack_integrations_user_id;

-- slack_notification_settings table
DROP INDEX IF EXISTS idx_slack_notification_settings_org_feature;

-- slack_notifications_sent table
DROP INDEX IF EXISTS idx_slack_notifications_sent_channel;
DROP INDEX IF EXISTS idx_slack_notifications_sent_lookup;

-- slack_org_settings table
DROP INDEX IF EXISTS idx_slack_org_settings_slack_team_id;

-- slack_user_mappings table
DROP INDEX IF EXISTS idx_slack_user_mappings_email;
DROP INDEX IF EXISTS idx_slack_user_mappings_sixty_user;

-- smart_task_templates table
DROP INDEX IF EXISTS idx_smart_task_templates_trigger;

-- subscription_plans table
DROP INDEX IF EXISTS idx_subscription_plans_is_free_tier;
DROP INDEX IF EXISTS idx_subscription_plans_slug;
DROP INDEX IF EXISTS idx_subscription_plans_stripe_product;

-- subscription_seat_usage table
DROP INDEX IF EXISTS idx_seat_usage_org_id;
DROP INDEX IF EXISTS idx_seat_usage_period;
DROP INDEX IF EXISTS idx_seat_usage_subscription_id;

-- task_notifications table
DROP INDEX IF EXISTS idx_task_notifications_read;

-- tasks table
DROP INDEX IF EXISTS idx_tasks_clerk_org_created;
DROP INDEX IF EXISTS idx_tasks_clerk_org_id;
DROP INDEX IF EXISTS idx_tasks_completed;
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_tasks_google_task_id;
DROP INDEX IF EXISTS idx_tasks_google_task_id_assigned_to;
DROP INDEX IF EXISTS idx_tasks_importance;
DROP INDEX IF EXISTS idx_tasks_metadata_action_item;
DROP INDEX IF EXISTS idx_tasks_parent_lookup;
DROP INDEX IF EXISTS idx_tasks_parent_task_id;
DROP INDEX IF EXISTS idx_tasks_priority;
DROP INDEX IF EXISTS idx_tasks_source;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_sync_status;
DROP INDEX IF EXISTS idx_tasks_top_level;
DROP INDEX IF EXISTS idx_tasks_type;

-- topic_aggregation_queue table
DROP INDEX IF EXISTS idx_aggregation_queue_pending;
DROP INDEX IF EXISTS idx_aggregation_queue_user_meeting;

-- usage_events table
DROP INDEX IF EXISTS idx_usage_events_created_at;
DROP INDEX IF EXISTS idx_usage_events_org_id;
DROP INDEX IF EXISTS idx_usage_events_type;

-- user_ai_feature_settings table
DROP INDEX IF EXISTS idx_user_ai_feature_settings_feature_key;

-- user_automation_rules table
DROP INDEX IF EXISTS idx_user_automation_rules_trigger_type;
DROP INDEX IF EXISTS idx_user_automation_rules_user_id;

-- user_coaching_preferences table
DROP INDEX IF EXISTS idx_user_coaching_preferences_active;

-- user_file_search_stores table
DROP INDEX IF EXISTS idx_user_file_search_stores_user_id;

-- user_notifications table
DROP INDEX IF EXISTS idx_user_notifications_created_at;
DROP INDEX IF EXISTS idx_user_notifications_is_read;
DROP INDEX IF EXISTS idx_user_notifications_org_id;
DROP INDEX IF EXISTS idx_user_notifications_type;

-- user_onboarding_progress table
DROP INDEX IF EXISTS idx_user_onboarding_progress_step;

-- user_settings table
DROP INDEX IF EXISTS idx_user_settings_preferences_gin;
DROP INDEX IF EXISTS idx_user_settings_user_id;

-- user_sync_status table
DROP INDEX IF EXISTS idx_user_sync_status_calendar_synced;

-- user_writing_styles table
DROP INDEX IF EXISTS idx_user_writing_styles_metadata;
DROP INDEX IF EXISTS idx_user_writing_styles_user_id;

-- variable_storage table
DROP INDEX IF EXISTS idx_variable_storage_expires;
DROP INDEX IF EXISTS idx_variable_storage_workflow;

-- waitlist_admin_actions table
DROP INDEX IF EXISTS idx_admin_actions_admin_id;
DROP INDEX IF EXISTS idx_admin_actions_created;
DROP INDEX IF EXISTS idx_admin_actions_entry_id;
DROP INDEX IF EXISTS idx_admin_actions_type;

-- waitlist_email_invites table
DROP INDEX IF EXISTS idx_email_invites_email;
DROP INDEX IF EXISTS idx_email_invites_entry_id;
DROP INDEX IF EXISTS idx_email_invites_status;

-- waitlist_email_templates table
DROP INDEX IF EXISTS idx_waitlist_email_templates_active;
DROP INDEX IF EXISTS idx_waitlist_email_templates_default_per_type;
DROP INDEX IF EXISTS idx_waitlist_email_templates_type;

-- waitlist_onboarding_progress table
DROP INDEX IF EXISTS idx_waitlist_onboarding_completion;
DROP INDEX IF EXISTS idx_waitlist_onboarding_entry_id;
DROP INDEX IF EXISTS idx_waitlist_onboarding_stuck_users;

-- waitlist_shares table
DROP INDEX IF EXISTS idx_waitlist_shares_clicked;
DROP INDEX IF EXISTS idx_waitlist_shares_converted;
DROP INDEX IF EXISTS idx_waitlist_shares_created_at;
DROP INDEX IF EXISTS idx_waitlist_shares_entry;
DROP INDEX IF EXISTS idx_waitlist_shares_platform;

-- workflow_circuit_breakers table
DROP INDEX IF EXISTS idx_circuit_breakers_lookup;

-- workflow_dlq table
DROP INDEX IF EXISTS idx_dlq_status;

-- workflow_executions table
DROP INDEX IF EXISTS idx_workflow_executions_user_id;
DROP INDEX IF EXISTS idx_workflow_executions_workflow_id;

-- workflow_forms table
DROP INDEX IF EXISTS idx_workflow_forms_test;
DROP INDEX IF EXISTS idx_workflow_forms_workflow_id;

-- workflow_idempotency_keys table
DROP INDEX IF EXISTS idx_idempotency_keys_lookup;

-- workflow_rate_limits table
DROP INDEX IF EXISTS idx_rate_limits_lookup;


-- ============================================================================
-- PART 2: ADD MISSING FOREIGN KEY INDEXES (90 indexes)
-- These indexes improve JOIN and DELETE performance on FK columns
-- ============================================================================

-- activities table
CREATE INDEX IF NOT EXISTS idx_activities_company_fk ON activities (company_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_fk ON activities (contact_id);

-- activity_sync_rules table
CREATE INDEX IF NOT EXISTS idx_activity_sync_rules_owner_fk ON activity_sync_rules (owner_id);

-- ai_cost_events table
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_user_fk ON ai_cost_events (user_id);

-- api_requests table
CREATE INDEX IF NOT EXISTS idx_api_requests_user_fk ON api_requests (user_id);

-- automation_executions table
CREATE INDEX IF NOT EXISTS idx_automation_executions_executed_by_fk ON automation_executions (executed_by);
CREATE INDEX IF NOT EXISTS idx_automation_executions_task_fk ON automation_executions (task_id);

-- branding_settings table
CREATE INDEX IF NOT EXISTS idx_branding_settings_created_by_fk ON branding_settings (created_by);

-- calendar_attendees table
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_event_fk ON calendar_attendees (event_id);

-- calendar_calendars table
CREATE INDEX IF NOT EXISTS idx_calendar_calendars_user_fk ON calendar_calendars (user_id);

-- calendar_events table
CREATE INDEX IF NOT EXISTS idx_calendar_events_mcp_connection_fk ON calendar_events (mcp_connection_id);

-- calendar_reminders table
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event_fk ON calendar_reminders (event_id);

-- challenge_features table
CREATE INDEX IF NOT EXISTS idx_challenge_features_challenge_fk ON challenge_features (challenge_id);

-- communication_events table
CREATE INDEX IF NOT EXISTS idx_communication_events_previous_event_fk ON communication_events (previous_event_id);

-- contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_company_fk ON contacts (company_id);

-- deal_activities table
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_fk ON deal_activities (deal_id);

-- deal_health_alerts table
CREATE INDEX IF NOT EXISTS idx_deal_health_alerts_acknowledged_by_fk ON deal_health_alerts (acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_deal_health_alerts_health_score_fk ON deal_health_alerts (health_score_id);

-- deal_health_rules table
CREATE INDEX IF NOT EXISTS idx_deal_health_rules_created_by_fk ON deal_health_rules (created_by);

-- deal_migration_reviews table
CREATE INDEX IF NOT EXISTS idx_deal_migration_reviews_resolved_by_fk ON deal_migration_reviews (resolved_by);
CREATE INDEX IF NOT EXISTS idx_deal_migration_reviews_suggested_company_fk ON deal_migration_reviews (suggested_company_id);
CREATE INDEX IF NOT EXISTS idx_deal_migration_reviews_suggested_contact_fk ON deal_migration_reviews (suggested_contact_id);

-- deal_stage_history table
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_fk ON deal_stage_history (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_stage_fk ON deal_stage_history (stage_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_user_fk ON deal_stage_history (user_id);

-- deals table
CREATE INDEX IF NOT EXISTS idx_deals_company_fk ON deals (company_id);

-- email_attachments table
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_fk ON email_attachments (email_id);

-- email_label_map table
CREATE INDEX IF NOT EXISTS idx_email_label_map_email_fk ON email_label_map (email_id);
CREATE INDEX IF NOT EXISTS idx_email_label_map_label_fk ON email_label_map (label_id);

-- email_labels table
CREATE INDEX IF NOT EXISTS idx_email_labels_user_fk ON email_labels (user_id);

-- email_templates table
CREATE INDEX IF NOT EXISTS idx_email_templates_user_fk ON email_templates (user_id);

-- emails table
CREATE INDEX IF NOT EXISTS idx_emails_mcp_connection_fk ON emails (mcp_connection_id);

-- fathom_transcript_retry_jobs table
CREATE INDEX IF NOT EXISTS idx_fathom_transcript_retry_jobs_user_fk ON fathom_transcript_retry_jobs (user_id);

-- google_oauth_states table
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_fk ON google_oauth_states (user_id);

-- internal_users table
CREATE INDEX IF NOT EXISTS idx_internal_users_added_by_fk ON internal_users (added_by);

-- lead_prep_notes table
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_created_by_fk ON lead_prep_notes (created_by);

-- lead_sources table
CREATE INDEX IF NOT EXISTS idx_lead_sources_default_owner_fk ON lead_sources (default_owner_id);

-- leads table
CREATE INDEX IF NOT EXISTS idx_leads_company_fk ON leads (company_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_fk ON leads (contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_deal_fk ON leads (converted_deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_by_fk ON leads (created_by);

-- meeting_generated_content table
CREATE INDEX IF NOT EXISTS idx_meeting_generated_content_parent_fk ON meeting_generated_content (parent_id);

-- meeting_intelligence_queries table
CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_queries_user_fk ON meeting_intelligence_queries (user_id);

-- meeting_metrics table
CREATE INDEX IF NOT EXISTS idx_meeting_metrics_meeting_fk ON meeting_metrics (meeting_id);

-- meeting_topics table
CREATE INDEX IF NOT EXISTS idx_meeting_topics_meeting_fk ON meeting_topics (meeting_id);

-- meetings table
CREATE INDEX IF NOT EXISTS idx_meetings_company_fk ON meetings (company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contact_fk ON meetings (contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by_fk ON meetings (created_by);

-- meetings_waitlist table
CREATE INDEX IF NOT EXISTS idx_meetings_waitlist_access_granted_by_fk ON meetings_waitlist (access_granted_by);
CREATE INDEX IF NOT EXISTS idx_meetings_waitlist_granted_by_fk ON meetings_waitlist (granted_by);
CREATE INDEX IF NOT EXISTS idx_meetings_waitlist_released_by_fk ON meetings_waitlist (released_by);

-- next_action_suggestions table
CREATE INDEX IF NOT EXISTS idx_next_action_suggestions_contact_fk ON next_action_suggestions (contact_id);
CREATE INDEX IF NOT EXISTS idx_next_action_suggestions_user_fk ON next_action_suggestions (user_id);

-- notification_rate_limits table
CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_user_fk ON notification_rate_limits (user_id);

-- notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_created_by_fk ON notifications (created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_fk ON notifications (user_id);

-- organization_feature_flags table
CREATE INDEX IF NOT EXISTS idx_organization_feature_flags_enabled_by_fk ON organization_feature_flags (enabled_by);

-- organization_invitations table
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invited_by_fk ON organization_invitations (invited_by);

-- pipeline_stage_recommendations table
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_recommendations_contact_fk ON pipeline_stage_recommendations (contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_recommendations_reviewed_by_fk ON pipeline_stage_recommendations (reviewed_by);

-- proposal_jobs table
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_user_fk ON proposal_jobs (user_id);

-- proposal_templates table
CREATE INDEX IF NOT EXISTS idx_proposal_templates_user_fk ON proposal_templates (user_id);

-- proposals table
CREATE INDEX IF NOT EXISTS idx_proposals_contact_fk ON proposals (contact_id);
CREATE INDEX IF NOT EXISTS idx_proposals_meeting_fk ON proposals (meeting_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_fk ON proposals (user_id);

-- rate_limit table
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_fk ON rate_limit (user_id);

-- roadmap_comments table
CREATE INDEX IF NOT EXISTS idx_roadmap_comments_user_fk ON roadmap_comments (user_id);

-- savvycal_source_mappings table
CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_created_by_fk ON savvycal_source_mappings (created_by);

-- slack_notification_settings table
CREATE INDEX IF NOT EXISTS idx_slack_notification_settings_org_fk ON slack_notification_settings (org_id);

-- slack_notifications_sent table
CREATE INDEX IF NOT EXISTS idx_slack_notifications_sent_org_fk ON slack_notifications_sent (org_id);

-- slack_org_settings table
CREATE INDEX IF NOT EXISTS idx_slack_org_settings_connected_by_fk ON slack_org_settings (connected_by);

-- slack_user_mappings table
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_org_fk ON slack_user_mappings (org_id);

-- smart_task_templates table
CREATE INDEX IF NOT EXISTS idx_smart_task_templates_created_by_fk ON smart_task_templates (created_by);

-- solutions table
CREATE INDEX IF NOT EXISTS idx_solutions_challenge_fk ON solutions (challenge_id);

-- targets table
CREATE INDEX IF NOT EXISTS idx_targets_closed_by_fk ON targets (closed_by);
CREATE INDEX IF NOT EXISTS idx_targets_created_by_fk ON targets (created_by);
CREATE INDEX IF NOT EXISTS idx_targets_previous_target_fk ON targets (previous_target_id);
CREATE INDEX IF NOT EXISTS idx_targets_team_fk ON targets (team_id);
CREATE INDEX IF NOT EXISTS idx_targets_user_fk ON targets (user_id);

-- tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_company_fk ON tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_fk ON tasks (contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_fk ON tasks (deal_id);

-- team_members table
CREATE INDEX IF NOT EXISTS idx_team_members_team_fk ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_fk ON team_members (user_id);

-- topic_aggregation_queue table
CREATE INDEX IF NOT EXISTS idx_topic_aggregation_queue_meeting_fk ON topic_aggregation_queue (meeting_id);
CREATE INDEX IF NOT EXISTS idx_topic_aggregation_queue_user_fk ON topic_aggregation_queue (user_id);

-- waitlist_email_templates table
CREATE INDEX IF NOT EXISTS idx_waitlist_email_templates_created_by_fk ON waitlist_email_templates (created_by);

-- workflow_forms table
CREATE INDEX IF NOT EXISTS idx_workflow_forms_created_by_fk ON workflow_forms (created_by);

-- workflow_mcp_logs table
CREATE INDEX IF NOT EXISTS idx_workflow_mcp_logs_user_fk ON workflow_mcp_logs (user_id);


-- ============================================================================
-- PART 3: DROP BACKUP TABLES (no primary key warnings)
-- ============================================================================

DROP TABLE IF EXISTS tasks_backup_20250106;
DROP TABLE IF EXISTS meeting_action_items_backup_20250106;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Dropped: 427 unused indexes (~8.9 MB saved)
-- Created: 90 FK indexes (improves JOIN/DELETE performance)
-- Dropped: 2 backup tables (no primary key)
