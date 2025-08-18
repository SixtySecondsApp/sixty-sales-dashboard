-- Upgrade Phil O'Brien from Trainee to Junior
-- Phil is no longer training, so promoting him one level up

-- Step 1: Check current user details
SELECT 
    'Before Upgrade' as status,
    id,
    first_name,
    last_name,
    email,
    stage as current_stage
FROM profiles 
WHERE email = 'phil@sixtyseconds.video'
   OR (first_name ILIKE '%phil%' AND last_name ILIKE '%bri%');

-- Step 2: Update Phil O'Brien's stage from Trainee to Junior
UPDATE profiles 
SET 
    stage = 'Junior',
    updated_at = NOW()
WHERE email = 'phil@sixtyseconds.video'
   OR (first_name ILIKE '%phil%' AND last_name ILIKE '%bri%');

-- Step 3: Verify the upgrade
SELECT 
    'After Upgrade' as status,
    id,
    first_name,
    last_name,
    email,
    stage as new_stage,
    updated_at
FROM profiles 
WHERE email = 'phil@sixtyseconds.video'
   OR (first_name ILIKE '%phil%' AND last_name ILIKE '%bri%');

-- Step 4: Show all user levels for reference
SELECT 
    'All User Levels' as info,
    stage,
    COUNT(*) as user_count,
    STRING_AGG(first_name || ' ' || last_name, ', ' ORDER BY first_name) as users
FROM profiles 
WHERE stage IS NOT NULL
GROUP BY stage
ORDER BY 
    CASE stage 
        WHEN 'Trainee' THEN 1
        WHEN 'Junior' THEN 2  
        WHEN 'Senior' THEN 3
        WHEN 'Director' THEN 4
        ELSE 5
    END;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Phil O''Brien has been upgraded from Trainee to Junior!';
    RAISE NOTICE '🎉 He is no longer in training and has been promoted.';
    RAISE NOTICE '💡 The change will take effect immediately in the dashboard.';
    RAISE NOTICE '';
END $$;