-- Complete script to undo renaming and merge duplicate companies
-- Run this entire script in Supabase SQL Editor

-- STEP 1: Show current state of renamed companies
SELECT '=== STEP 1: Current renamed companies ===' as step;
SELECT id, name, created_at
FROM companies
WHERE name LIKE '% (%)'
ORDER BY name;

-- STEP 2: Undo the renaming by removing the (2), (3), etc. suffixes
SELECT '=== STEP 2: Undoing renaming ===' as step;
UPDATE companies
SET name = REGEXP_REPLACE(name, ' \(\d+\)$', '')
WHERE name LIKE '% (%)';

-- Show what we now have (duplicates restored)
SELECT name, COUNT(*) as count
FROM companies
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- STEP 3: Show what will be merged (for transparency)
SELECT '=== STEP 3: Companies to be merged ===' as step;
SELECT 
    name,
    COUNT(*) as duplicate_count,
    MIN(created_at) as "Oldest created_at",
    MAX(created_at) as "Newest created_at"
FROM companies
WHERE name IN (
    SELECT name 
    FROM companies 
    GROUP BY name 
    HAVING COUNT(*) > 1
)
GROUP BY name
ORDER BY name;

-- STEP 4: Perform the merge
SELECT '=== STEP 4: Merging duplicates ===' as step;
DO $$
DECLARE
    v_dup_group RECORD;
    v_dup_company RECORD;
    v_keep_id UUID;
    v_merge_count INTEGER := 0;
BEGIN
    -- Handle each group of duplicates
    FOR v_dup_group IN 
        SELECT DISTINCT name
        FROM companies
        GROUP BY name
        HAVING COUNT(*) > 1
    LOOP
        -- Get the ID of the oldest company with this name
        SELECT id INTO v_keep_id
        FROM companies
        WHERE name = v_dup_group.name
        ORDER BY created_at, id
        LIMIT 1;
        RAISE NOTICE 'Merging duplicates for company: % (keeping ID: %)', v_dup_group.name, v_keep_id;
        
        -- Update all references to duplicate companies to point to the keeper
        FOR v_dup_company IN 
            SELECT id
            FROM companies 
            WHERE name = v_dup_group.name 
            AND id != v_keep_id
        LOOP
            -- Update contacts to point to the keeper company
            UPDATE contacts 
            SET company_id = v_keep_id 
            WHERE company_id = v_dup_company.id;
            
            -- Update deals to point to the keeper company (if column exists)
            BEGIN
                EXECUTE 'UPDATE deals SET company_id = $1 WHERE company_id = $2' 
                USING v_keep_id, v_dup_company.id;
            EXCEPTION 
                WHEN undefined_column THEN 
                    NULL; -- Column doesn't exist yet, skip
            END;
            
            -- Update activities to point to the keeper company (if column exists)
            BEGIN
                EXECUTE 'UPDATE activities SET company_id = $1 WHERE company_id = $2' 
                USING v_keep_id, v_dup_company.id;
            EXCEPTION 
                WHEN undefined_column THEN 
                    NULL; -- Column doesn't exist yet, skip
            END;
            
            -- Delete the duplicate company
            DELETE FROM companies WHERE id = v_dup_company.id;
            v_merge_count := v_merge_count + 1;
            
            RAISE NOTICE 'Merged and deleted duplicate company ID: %', v_dup_company.id;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '==================================';
    RAISE NOTICE 'Merge complete! Results:';
    RAISE NOTICE '- Companies merged: %', v_merge_count;
    RAISE NOTICE '==================================';
END $$;

-- STEP 5: Verify no duplicates remain
SELECT '=== STEP 5: Verification ===' as step;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCESS - All duplicates merged!'
        ELSE '❌ FAILED - ' || COUNT(*) || ' duplicate company names still exist'
    END as merge_status,
    COUNT(*) as remaining_duplicates
FROM (
    SELECT name
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
) as dups;

-- STEP 6: Show the final merged companies
SELECT '=== STEP 6: Final merged companies ===' as step;
SELECT id, name, created_at, owner_id
FROM companies
WHERE name IN ('Aleto Foundation', 'Fynity Talent', 'Happiest at Home', 'Nicer Group', 'Pure Performance')
ORDER BY name;

-- STEP 7: Show count of related records for merged companies
SELECT '=== STEP 7: Related records count ===' as step;
SELECT 
    c.name as company_name,
    COUNT(DISTINCT con.id) as contact_count
FROM companies c
LEFT JOIN contacts con ON con.company_id = c.id
WHERE c.name IN ('Aleto Foundation', 'Fynity Talent', 'Happiest at Home', 'Nicer Group', 'Pure Performance')
GROUP BY c.id, c.name
ORDER BY c.name;

-- STEP 8: Ready for main migration
SELECT '=== STEP 8: Next Steps ===' as step;
SELECT 'Duplicates merged successfully! Now run: 20250902_fix_all_missing_crm_structures.sql' as next_action;