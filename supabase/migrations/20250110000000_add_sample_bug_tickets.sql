-- Add sample bug tickets to roadmap for fixing
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Try to get an admin user, or just get any user
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE id IN (
        SELECT id FROM profiles WHERE is_admin = true LIMIT 1
    )
    LIMIT 1;
    
    -- If no admin found, get any user
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
    END IF;
    
    -- Only proceed if we have a user
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO roadmap_suggestions (
            title,
            description,
            type,
            priority,
            status,
            submitted_by,
            estimated_effort,
            admin_notes
        ) VALUES 
        (
            'Task completion date not updating correctly',
            'When marking tasks as completed, the completion date field is not being set properly. This affects reporting and task history tracking.',
            'bug',
            'high',
            'under_review',
            admin_user_id,
            'medium',
            'Bug identified in task completion workflow'
        ),
        (
            'Roadmap drag and drop causes status inconsistency',
            'When dragging roadmap items between columns, sometimes the status in the database does not match the column position, causing visual inconsistencies.',
            'bug',
            'medium',
            'under_review',
            admin_user_id,
            'small',
            'Reported by multiple users'
        ),
        (
            'Contact email validation allows invalid formats',
            'The contact form accepts email addresses that do not follow proper email format standards, leading to bounced emails and invalid data.',
            'bug',
            'medium',
            'under_review',
            admin_user_id,
            'small',
            'Data quality issue affecting email campaigns'
        ),
        (
            'Dashboard metrics showing incorrect calculations',
            'Revenue and conversion rate metrics on the dashboard are not calculating correctly when filtering by date ranges.',
            'bug',
            'critical',
            'under_review',
            admin_user_id,
            'large',
            'Critical business metric accuracy issue'
        );
    END IF;
END $$;