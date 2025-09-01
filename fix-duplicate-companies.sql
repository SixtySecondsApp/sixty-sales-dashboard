-- Script to identify and fix duplicate company names before running the migration
-- Run this BEFORE applying the main migration if you get duplicate key errors

-- 1. Show duplicate company names
SELECT name, COUNT(*) as count
FROM companies
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC, name;

-- 2. Show all companies with duplicate names (with their IDs and creation dates)
SELECT id, name, created_at, owner_id
FROM companies
WHERE name IN (
    SELECT name
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
)
ORDER BY name, created_at;

-- 3. Fix duplicates by appending numbers to all but the oldest entry
DO $$
DECLARE
  v_dup_group RECORD;
  v_dup_company RECORD;
  v_counter INTEGER;
BEGIN
  -- Handle each group of duplicates
  FOR v_dup_group IN 
    SELECT name, COUNT(*) as cnt
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Processing duplicates for company: %', v_dup_group.name;
    v_counter := 2; -- Start numbering from 2 (first one stays unchanged)
    
    -- Update all but the first occurrence
    FOR v_dup_company IN 
      SELECT id, name, created_at
      FROM companies 
      WHERE name = v_dup_group.name 
      ORDER BY created_at, id  -- Keep oldest unchanged
      OFFSET 1  -- Skip the first one
    LOOP
      UPDATE companies 
      SET name = v_dup_group.name || ' (' || v_counter || ')'
      WHERE id = v_dup_company.id;
      
      RAISE NOTICE 'Renamed company % to %', v_dup_company.id, v_dup_group.name || ' (' || v_counter || ')';
      v_counter := v_counter + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Duplicate cleanup complete!';
END $$;

-- 4. Verify no duplicates remain
SELECT 'After cleanup - duplicates remaining:' as status, COUNT(*) as count
FROM (
    SELECT name
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
) as dups;

-- 5. Show the renamed companies
SELECT id, name, created_at
FROM companies
WHERE name LIKE '% (%)'
ORDER BY name;