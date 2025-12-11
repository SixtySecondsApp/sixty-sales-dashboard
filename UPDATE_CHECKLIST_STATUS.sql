-- Update Launch Checklist - Mark P0 items as completed (Pending QA)
-- Run this in the Supabase SQL Editor

-- Mark P0 items as completed
UPDATE launch_checklist_items 
SET 
  status = 'completed', 
  completed_at = NOW(),
  notes = 'Deployed Dec 11, 2025 - Pending QA'
WHERE task_id IN (
  'p0-free-tier-enforcement',
  'p0-upgrade-gate-history', 
  'p0-stripe-webhooks',
  'p0-encharge-email-integration'
);

-- Add the new completed items
INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, status, completed_at, order_index, notes, subtasks)
VALUES
('p0-fast-onboarding-sync', 'completed', 'Fast Time-to-Value Onboarding Sync', 
 'Two-phase sync: 3 meetings fast → rest in background. User can continue immediately. Updated SyncProgressStep.tsx with new UI.', 
 '4h', 'completed', NOW(), 10, 'Deployed Dec 11, 2025 - Pending QA', '[]'::jsonb),
 
('p0-encharge-edge-function', 'completed', 'Encharge.io Email Edge Function', 
 'Created encharge-email Edge Function for transactional emails via Encharge API. Supports 10 email types. Created enchargeEmailService.ts frontend service.', 
 '4h', 'completed', NOW(), 11, 'Deployed Dec 11, 2025 - Pending QA', '[]'::jsonb),

('p0-free-tier-db-enforcement', 'completed', 'Free Tier Database Enforcement', 
 'Added is_historical_import column to meetings, check_meeting_limits() and mark_onboarding_complete() functions. Updated fathom-sync Edge Function.', 
 '4h', 'completed', NOW(), 12, 'Deployed & Tested Dec 11, 2025 - Pending QA', '[]'::jsonb),

('p0-historical-upgrade-gate-ui', 'completed', 'Historical Meeting Upgrade Gate UI', 
 'Created HistoricalUpgradeGate modal component. Updated useFathomIntegration hook to return limit info and support new sync types.', 
 '2h', 'completed', NOW(), 13, 'Deployed Dec 11, 2025 - Pending QA', '[]'::jsonb),

('p0-stripe-webhook-checklist', 'completed', 'Stripe Webhook Verification Checklist', 
 'Created comprehensive STRIPE_WEBHOOK_TESTING.md with test procedures for all webhook events.', 
 '1h', 'completed', NOW(), 14, 'Completed Dec 11, 2025', '[]'::jsonb)

ON CONFLICT (task_id) DO UPDATE SET
  status = 'completed',
  completed_at = NOW(),
  notes = EXCLUDED.notes;

-- Verify the updates
SELECT task_id, title, status, completed_at, notes 
FROM launch_checklist_items 
WHERE status = 'completed'
ORDER BY completed_at DESC;
