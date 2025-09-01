-- Temporarily disable the auto_process_activity triggers to test QuickAdd
-- This will help us determine if the trigger is causing the foreign key constraint error

-- Disable the triggers
ALTER TABLE activities DISABLE TRIGGER trigger_auto_process_activity_insert;
ALTER TABLE activities DISABLE TRIGGER trigger_auto_process_activity_update;

SELECT 'Auto-process activity triggers disabled. Test QuickAdd now.' as status;