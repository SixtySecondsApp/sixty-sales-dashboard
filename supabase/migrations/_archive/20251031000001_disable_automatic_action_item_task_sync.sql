-- Migration: Disable Automatic Action Item to Task Sync
-- Purpose: Make task creation manual instead of automatic
-- Date: 2025-10-31

-- Drop the automatic trigger
DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;

-- Keep the function but don't trigger it automatically
-- This allows manual task creation via the UI while maintaining the logic
COMMENT ON FUNCTION auto_create_task_from_action_item() IS 'Manual task creation from action items - called via UI button, not automatic trigger';

-- Add helpful comment
COMMENT ON TABLE meeting_action_items IS 'Action items from Fathom meetings - task creation is now manual via UI buttons';
