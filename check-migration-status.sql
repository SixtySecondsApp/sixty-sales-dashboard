-- Check if the new columns exist in the activities table
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'activities' 
  AND column_name IN ('outbound_type', 'proposal_date', 'is_rebooking', 'is_self_generated', 'sale_date')
ORDER BY column_name;

-- Also check if there are any activities to test with
SELECT id, type, client_name, 
       outbound_type, proposal_date, is_rebooking, is_self_generated, sale_date
FROM activities 
LIMIT 5;