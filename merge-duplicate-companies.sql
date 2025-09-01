-- Script to merge duplicate company records together
-- This will keep the oldest company and update all references to point to it

-- 1. First, show what will be merged
WITH duplicate_groups AS (
    SELECT 
        name,
        MIN(id) as keep_id,
        MIN(created_at) as keep_created_at,
        COUNT(*) as duplicate_count,
        STRING_AGG(id::text, ', ' ORDER BY created_at) as all_ids
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
)
SELECT 
    name,
    duplicate_count,
    keep_id as "ID to keep (oldest)",
    keep_created_at as "Created at",
    all_ids as "All IDs (oldest first)"
FROM duplicate_groups
ORDER BY name;

-- 2. Perform the merge
DO $$
DECLARE
    v_dup_group RECORD;
    v_dup_company RECORD;
    v_keep_id UUID;
    v_merge_count INTEGER := 0;
BEGIN
    -- Handle each group of duplicates
    FOR v_dup_group IN 
        SELECT name, MIN(id) as keep_id, COUNT(*) as cnt
        FROM companies
        GROUP BY name
        HAVING COUNT(*) > 1
    LOOP
        v_keep_id := v_dup_group.keep_id;
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
    
    RAISE NOTICE 'Merge complete! Merged % duplicate companies', v_merge_count;
END $$;

-- 3. Verify no duplicates remain
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

-- 4. Show the final company list for the previously duplicated names
SELECT id, name, created_at, owner_id
FROM companies
WHERE name IN ('Aleto Foundation', 'Fynity Talent', 'Happiest at Home', 'Nicer Group', 'Pure Performance')
ORDER BY name;

-- 5. Show count of related records that were updated
SELECT 
    'Contacts linked to merged companies' as record_type,
    COUNT(*) as count
FROM contacts
WHERE company_id IN (
    SELECT MIN(id)
    FROM companies
    WHERE name IN ('Aleto Foundation', 'Fynity Talent', 'Happiest at Home', 'Nicer Group', 'Pure Performance')
    GROUP BY name
);