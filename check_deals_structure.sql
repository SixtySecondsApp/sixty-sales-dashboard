
-- Check the structure of deals table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deals' 
ORDER BY ordinal_position;

-- Check sample deals data to understand the structure
SELECT * FROM deals LIMIT 3;

