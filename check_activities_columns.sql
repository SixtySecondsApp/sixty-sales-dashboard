
-- Check actual activities table structure and sample data
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activities' 
ORDER BY ordinal_position;

