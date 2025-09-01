-- Re-enable the auto_process_activity triggers after testing

-- Enable the triggers
ALTER TABLE activities ENABLE TRIGGER trigger_auto_process_activity_insert;
ALTER TABLE activities ENABLE TRIGGER trigger_auto_process_activity_update;

SELECT 'Auto-process activity triggers re-enabled.' as status;