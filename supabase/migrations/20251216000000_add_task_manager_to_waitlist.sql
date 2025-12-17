-- Add task_manager_tool and task_manager_other columns to meetings_waitlist table
-- This allows tracking which task management tool users prefer

ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS task_manager_tool TEXT,
ADD COLUMN IF NOT EXISTS task_manager_other TEXT;

-- Add comments
COMMENT ON COLUMN meetings_waitlist.task_manager_tool IS 'Task management tool preference (Monday, Jira, Coda, Asana, Teams, Trello, Other, None)';
COMMENT ON COLUMN meetings_waitlist.task_manager_other IS 'Custom task manager name when task_manager_tool is "Other"';
