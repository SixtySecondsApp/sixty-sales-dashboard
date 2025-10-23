-- Check which table is missing the execution_order column

-- Check activities table columns
SELECT 
    'Activities Table Columns' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'activities'
ORDER BY ordinal_position;

-- Check if execution_order exists in any table
SELECT 
    'Tables with execution_order' as check_type,
    table_schema,
    table_name,
    column_name
FROM information_schema.columns
WHERE column_name = 'execution_order';

-- If the column is missing from activities, add it
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS execution_order integer DEFAULT 0;

-- Also check user_automation_rules columns
SELECT 
    'user_automation_rules Columns' as check_type,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'user_automation_rules'
AND column_name IN ('execution_order', 'canvas_data', 'action_config', 'trigger_conditions')
ORDER BY ordinal_position;