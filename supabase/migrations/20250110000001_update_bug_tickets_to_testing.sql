-- Update bug tickets from under_review to testing status and add branch links
DO $$
BEGIN
    -- Update the task completion date bug
    UPDATE roadmap_suggestions 
    SET 
        status = 'testing',
        admin_notes = COALESCE(admin_notes, '') || E'\n\nFixed: Task completion date now properly sets to null when uncompleting tasks\nBranch: feature/fix-task-completion-date\nCommit: Fixed task completion date handling in useTasks.ts and TaskKanban.tsx'
    WHERE 
        title = 'Task completion date not updating correctly' 
        AND status = 'under_review'
        AND type = 'bug';

    -- Update the roadmap drag and drop bug
    UPDATE roadmap_suggestions 
    SET 
        status = 'testing',
        admin_notes = COALESCE(admin_notes, '') || E'\n\nFixed: Improved drag and drop with better error handling and state synchronization\nBranch: feature/fix-roadmap-drag-drop\nCommit: Enhanced RoadmapKanban.tsx with proper rollback and refresh logic'
    WHERE 
        title = 'Roadmap drag and drop causes status inconsistency' 
        AND status = 'under_review'
        AND type = 'bug';

    -- Update the contact email validation bug
    UPDATE roadmap_suggestions 
    SET 
        status = 'testing',
        admin_notes = COALESCE(admin_notes, '') || E'\n\nFixed: Implemented strict RFC-compliant email validation regex\nBranch: feature/fix-email-validation\nCommit: Updated IdentifierField.tsx and ContactEditModal.tsx with proper email validation'
    WHERE 
        title = 'Contact email validation allows invalid formats' 
        AND status = 'under_review'
        AND type = 'bug';

    -- Update the dashboard metrics bug
    UPDATE roadmap_suggestions 
    SET 
        status = 'testing',
        admin_notes = COALESCE(admin_notes, '') || E'\n\nFixed: Improved date filtering and calculation logic with better error handling\nBranch: feature/fix-dashboard-metrics\nCommit: Enhanced Dashboard.tsx with proper timezone handling and number parsing'
    WHERE 
        title = 'Dashboard metrics showing incorrect calculations' 
        AND status = 'under_review'
        AND type = 'bug';

    -- Log the update
    RAISE NOTICE 'Updated % bug tickets from under_review to testing status', 
        (SELECT COUNT(*) FROM roadmap_suggestions WHERE status = 'testing' AND type = 'bug');
        
END $$;