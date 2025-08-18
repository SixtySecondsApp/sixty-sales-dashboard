
-- Check the actual structure of activities table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activities' 
ORDER BY ordinal_position;

-- Also check a sample of activities data to see column names
SELECT * FROM activities LIMIT 3;

