
-- Find all company names that contain 'viewpoint' (case insensitive)
SELECT DISTINCT
    d.company,
    COUNT(*) as deal_count,
    STRING_AGG(d.name, ', ') as deal_names
FROM deals d 
WHERE LOWER(d.company) LIKE '%viewpoint%' 
GROUP BY d.company
ORDER BY deal_count DESC;

