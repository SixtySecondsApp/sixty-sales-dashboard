-- Quick verification script to check if the database is ready for the main migration
-- Run this to ensure no blocking issues exist

-- 1. Check for remaining duplicate company names
SELECT 
    'Duplicate companies' as check_item,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ READY - No duplicates found'
        ELSE '❌ NOT READY - ' || COUNT(*) || ' duplicate company names remain'
    END as status
FROM (
    SELECT name FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
) as dups;

-- 2. Check if companies table exists
SELECT 
    'Companies table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- 3. Check if contacts table exists
SELECT 
    'Contacts table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- 4. Check if activities table exists
SELECT 
    'Activities table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- 5. Check if deals table exists
SELECT 
    'Deals table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- 6. Check if profiles table exists (required for foreign keys)
SELECT 
    'Profiles table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING - Required for foreign keys'
    END as status;

-- 7. Check if companies table has owner_id column (not created_by)
SELECT 
    'Companies owner_id column' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'owner_id'
        )
        THEN '✅ EXISTS'
        ELSE '⚠️ MISSING - Will be added by migration'
    END as status;

-- 8. Check if unique constraint exists on companies.name
SELECT 
    'Companies name unique constraint' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'companies_name_key'
        )
        THEN '✅ EXISTS'
        ELSE '⚠️ MISSING - Will be added by migration'
    END as status;

-- 9. Summary
SELECT 
    '=== READY TO MIGRATE ===' as check_item,
    'Run the main migration: 20250902_fix_all_missing_crm_structures.sql' as status;