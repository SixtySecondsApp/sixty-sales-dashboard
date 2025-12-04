-- Check if there's a trigger that creates profiles when users are created
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_schema,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users' 
   OR action_statement ILIKE '%profile%'
ORDER BY trigger_name;
