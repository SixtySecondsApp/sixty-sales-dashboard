-- Check if slack_integrations table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'slack_integrations'
) as table_exists;

-- Check columns if table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'slack_integrations';