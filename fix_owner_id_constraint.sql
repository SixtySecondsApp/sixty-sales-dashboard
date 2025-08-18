-- Fix the owner_id constraint by using deal owner_id or default user
-- First check what columns exist in activities table

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'activities' 
ORDER BY ordinal_position;

-- Check if there are any users in profiles table to use as default
SELECT id, email, first_name, last_name 
FROM profiles 
LIMIT 5;

-- Check sample activities to see available fields
SELECT deal_id, client_name, sales_rep, date, amount, details
FROM activities 
WHERE type = 'sale' AND status = 'completed'
LIMIT 5;
