-- Add Amazon SES SMTP fix task to launch checklist
-- This is a BLOCKER - signup emails are not working

INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, order_index, status, subtasks) VALUES
('p0-ses-smtp-fix', 'p0', 'Fix Amazon SES SMTP Configuration', 
 'BLOCKER: Supabase Auth emails failing with "Invalid Sending Pool Name: IP Pool is not valid". Need to fix Amazon SES IP Pool configuration or remove the pool setting. Requires authenticator access.', 
 '1-2h', 0, 'blocked', '[
  {"id": "1", "title": "Access Amazon SES console with authenticator", "completed": false},
  {"id": "2", "title": "Check/fix IP Pool configuration", "completed": false},
  {"id": "3", "title": "Update Supabase SMTP settings", "completed": false},
  {"id": "4", "title": "Test signup flow end-to-end", "completed": false}
]'::jsonb)
ON CONFLICT (task_id) DO UPDATE SET
  status = 'blocked',
  description = EXCLUDED.description,
  order_index = 0;
