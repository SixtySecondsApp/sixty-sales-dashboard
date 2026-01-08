-- Update Launch Checklist with P0 progress

-- Mark completed items
UPDATE launch_checklist_items 
SET status = 'completed', completed_at = NOW()
WHERE task_id = 'p0-free-tier-enforcement';

UPDATE launch_checklist_items 
SET status = 'completed', completed_at = NOW()
WHERE task_id = 'p0-upgrade-gate-history';

UPDATE launch_checklist_items 
SET status = 'completed', completed_at = NOW()
WHERE task_id = 'p0-stripe-webhooks';

UPDATE launch_checklist_items 
SET status = 'completed', completed_at = NOW()
WHERE task_id = 'p0-encharge-email-integration';

-- Add new completed items if they don't exist
INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, status, completed_at, order_index, subtasks)
VALUES
('p0-fast-onboarding-sync', 'completed', 'Fast Time-to-Value Onboarding Sync', 
 'Two-phase sync: 3 meetings fast → rest in background. User can continue immediately.', 
 '4h', 'completed', NOW(), 10, '[]'::jsonb)
ON CONFLICT (task_id) DO UPDATE SET
  status = 'completed',
  completed_at = NOW();

INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, status, completed_at, order_index, subtasks)
VALUES
('p0-encharge-edge-function', 'completed', 'Encharge.io Email Edge Function', 
 'Created encharge-email Edge Function for transactional emails via Encharge API. Supports 10 email types.', 
 '4h', 'completed', NOW(), 11, '[]'::jsonb)
ON CONFLICT (task_id) DO UPDATE SET
  status = 'completed',
  completed_at = NOW();

INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, status, completed_at, order_index, subtasks)
VALUES
('p0-free-tier-db-enforcement', 'completed', 'Free Tier Database Enforcement', 
 'Added is_historical_import column, check_meeting_limits() function, mark_onboarding_complete() function. Migration ready.', 
 '2h', 'completed', NOW(), 12, '[]'::jsonb)
ON CONFLICT (task_id) DO UPDATE SET
  status = 'completed',
  completed_at = NOW();

INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, status, completed_at, order_index, subtasks)
VALUES
('p0-historical-upgrade-gate-ui', 'completed', 'Historical Meeting Upgrade Gate UI', 
 'Created HistoricalUpgradeGate modal component. Updated useFathomIntegration hook to return limit info.', 
 '2h', 'completed', NOW(), 13, '[]'::jsonb)
ON CONFLICT (task_id) DO UPDATE SET
  status = 'completed',
  completed_at = NOW();
