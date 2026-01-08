/**
 * Add proactive notification settings
 * 
 * Adds new notification features to slack_notification_settings:
 * - morning_brief
 * - stale_deal_alert
 * - email_reply_alert
 */

-- Add new notification features (default disabled)
INSERT INTO slack_notification_settings (org_id, feature, is_enabled, delivery_method, created_at, updated_at)
SELECT 
  org_id,
  'morning_brief',
  false,
  'dm',
  NOW(),
  NOW()
FROM slack_org_settings
WHERE is_connected = true
ON CONFLICT (org_id, feature) DO NOTHING;

INSERT INTO slack_notification_settings (org_id, feature, is_enabled, delivery_method, created_at, updated_at)
SELECT 
  org_id,
  'stale_deal_alert',
  false,
  'dm',
  NOW(),
  NOW()
FROM slack_org_settings
WHERE is_connected = true
ON CONFLICT (org_id, feature) DO NOTHING;

INSERT INTO slack_notification_settings (org_id, feature, is_enabled, delivery_method, created_at, updated_at)
SELECT 
  org_id,
  'email_reply_alert',
  false,
  'dm',
  NOW(),
  NOW()
FROM slack_org_settings
WHERE is_connected = true
ON CONFLICT (org_id, feature) DO NOTHING;

-- Add comment
COMMENT ON TABLE slack_notification_settings IS 'Organization-level settings for Slack proactive notifications. Features: morning_brief, sales_assistant, meeting_prep, meeting_debrief, stale_deal_alert, email_reply_alert';
