-- Move all roadmap tickets from 'under_review' (planned) to 'testing' status
-- This represents completed work that has been fixed/implemented and is ready for testing

UPDATE roadmap_suggestions 
SET status = 'testing', updated_at = NOW()
WHERE status = 'under_review' 
  AND (
    -- Bug fixes completed
    type = 'bug' OR
    -- Improvements completed  
    type = 'improvement' OR
    -- Features completed
    type = 'feature'
  );

-- Log the update
SELECT 
  COUNT(*) as tickets_moved,
  STRING_AGG(title, ', ') as ticket_titles
FROM roadmap_suggestions 
WHERE status = 'testing';