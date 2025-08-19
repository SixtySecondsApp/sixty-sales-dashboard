-- Convert Sales Activities to Subscription Clients
-- This script identifies sales activities marked as "subscription Sale" and converts them to clients

-- First, let's see what subscription sales we have that aren't converted yet
SELECT 
    a.id as activity_id,
    a.client_name as company_name,
    a.contact_email,
    a.amount,
    a.date as sale_date,
    a.details,
    c.id as existing_client_id
FROM activities a
LEFT JOIN clients c ON c.company_name = a.client_name 
WHERE a.type = 'sale' 
  AND a.details ILIKE '%subscription%'
  AND c.id IS NULL  -- Only show sales that haven't been converted to clients yet
ORDER BY a.date DESC;

-- Convert subscription sales to clients
-- This will create client records for each subscription sale that doesn't already have one

INSERT INTO clients (
    company_name,
    contact_name,
    contact_email,
    subscription_amount,
    status,
    deal_id,
    owner_id,
    subscription_start_date,
    created_at,
    updated_at
)
SELECT DISTINCT ON (a.client_name)
    a.client_name as company_name,
    COALESCE(
        CASE 
            WHEN a.contact_email LIKE '%@%' THEN 
                SPLIT_PART(SPLIT_PART(a.contact_email, '@', 1), '.', 1) || ' ' || 
                SPLIT_PART(SPLIT_PART(a.contact_email, '@', 1), '.', 2)
            ELSE a.client_name
        END,
        a.client_name
    ) as contact_name,
    a.contact_email,
    a.amount as subscription_amount,
    'active'::client_status as status,
    a.id as deal_id,  -- Link back to the original sale activity
    a.user_id as owner_id,
    a.date as subscription_start_date,
    NOW() as created_at,
    NOW() as updated_at
FROM activities a
LEFT JOIN clients c ON c.company_name = a.client_name
WHERE a.type = 'sale' 
  AND a.details ILIKE '%subscription%'
  AND c.id IS NULL  -- Only convert sales that haven't been converted yet
  AND a.amount > 0  -- Only convert sales with actual amounts
ORDER BY a.client_name, a.date DESC;

-- Show summary of what was converted
SELECT 
    'Subscription clients created' as summary,
    COUNT(*) as count
FROM clients c
WHERE c.created_at >= NOW() - INTERVAL '1 minute';

-- Show the new clients that were created
SELECT 
    c.company_name,
    c.contact_name,
    c.contact_email,
    c.subscription_amount,
    c.subscription_start_date,
    c.status
FROM clients c
WHERE c.created_at >= NOW() - INTERVAL '1 minute'
ORDER BY c.subscription_start_date DESC;

-- Update any existing activities to link them to the new clients
UPDATE activities a
SET client_id = c.id
FROM clients c
WHERE a.client_name = c.company_name
  AND a.type = 'sale'
  AND a.details ILIKE '%subscription%'
  AND a.client_id IS NULL;

-- Final verification - show subscription revenue summary
SELECT 
    COUNT(*) as total_subscription_clients,
    SUM(subscription_amount) as total_mrr,
    AVG(subscription_amount) as average_mrr,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
    COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_clients,
    COUNT(CASE WHEN status = 'churned' THEN 1 END) as churned_clients
FROM clients;