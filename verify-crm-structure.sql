-- Verification script to check if all required CRM structures exist
-- Run this in Supabase SQL Editor to verify the migration was successful

-- Check for companies table
SELECT 
    'companies table' as structure,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for contacts table
SELECT 
    'contacts table' as structure,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for activity_sync_rules table
SELECT 
    'activity_sync_rules table' as structure,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_sync_rules')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for primary_contact_id column in deals table
SELECT 
    'deals.primary_contact_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'deals' AND column_name = 'primary_contact_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for company_id column in deals table
SELECT 
    'deals.company_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'deals' AND column_name = 'company_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for owner_id column in companies table
SELECT 
    'companies.owner_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'owner_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING (should have owner_id, not created_by)'
    END as status;

-- Check for owner_id column in contacts table
SELECT 
    'contacts.owner_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'contacts' AND column_name = 'owner_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING (should have owner_id, not created_by)'
    END as status;

-- Check for company_id column in activities table
SELECT 
    'activities.company_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'activities' AND column_name = 'company_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for contact_id column in activities table
SELECT 
    'activities.contact_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'activities' AND column_name = 'contact_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for deal_id column in activities table
SELECT 
    'activities.deal_id column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'activities' AND column_name = 'deal_id'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for auto_matched column in activities table
SELECT 
    'activities.auto_matched column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'activities' AND column_name = 'auto_matched'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for is_processed column in activities table
SELECT 
    'activities.is_processed column' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'activities' AND column_name = 'is_processed'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for auto_process_activity function
SELECT 
    'auto_process_activity function' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'auto_process_activity'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check for triggers on activities table
SELECT 
    'auto_process_activity triggers' as structure,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname LIKE 'trigger_auto_process_activity%'
        )
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Summary
SELECT 
    '=== SUMMARY ===' as structure,
    'Run migration 20250902_fix_all_missing_crm_structures.sql if any items show ❌ MISSING' as status;