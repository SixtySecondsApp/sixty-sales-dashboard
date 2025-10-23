-- Activate the Sales Analysis Workflow for Andrew
UPDATE user_automation_rules 
SET is_active = true
WHERE id = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8';

-- Verify the workflow is active
SELECT 
    id, 
    user_id, 
    rule_name, 
    is_active,
    created_at
FROM user_automation_rules 
WHERE id = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8';