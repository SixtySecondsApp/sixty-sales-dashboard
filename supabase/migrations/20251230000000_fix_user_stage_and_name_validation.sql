-- ============================================================================
-- Migration: Fix User Stage and Name Validation Issues
-- ============================================================================
-- Issues Fixed:
-- 1. User stage incorrectly set to 'active' instead of valid 'Trainee'
-- 2. Names using empty strings instead of NULL (breaks organization naming)
-- 3. Incomplete signup entries like '[Incomplete Signup]' becoming real users
-- 4. No database constraints preventing invalid data
--
-- Impact: Users created via admin or signup now appear in user management
-- ============================================================================

-- ============================================================================
-- Phase 1: Fix user stage issue
-- ============================================================================

-- Step 1a: Update the handle_new_user trigger to use 'Trainee' instead of 'active'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_entry RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Try to get user info from waitlist entry first
  -- Exclude incomplete signups and ensure valid names
  SELECT full_name, company_name INTO v_waitlist_entry
  FROM meetings_waitlist
  WHERE LOWER(email) = LOWER(NEW.email)
    AND (user_id = NEW.id OR user_id IS NULL)
    AND full_name IS NOT NULL
    AND full_name NOT LIKE '[%'  -- Exclude '[Incomplete Signup]' and similar
    AND LENGTH(TRIM(full_name)) > 0
  ORDER BY created_at ASC
  LIMIT 1;

  -- Parse name from waitlist or use metadata, prefer NULL over empty strings
  IF v_waitlist_entry.full_name IS NOT NULL THEN
    -- Split waitlist full_name into first and last
    v_first_name := NULLIF(TRIM(SPLIT_PART(TRIM(v_waitlist_entry.full_name), ' ', 1)), '');
    v_last_name := NULLIF(TRIM(SUBSTRING(TRIM(v_waitlist_entry.full_name) FROM LENGTH(TRIM(SPLIT_PART(TRIM(v_waitlist_entry.full_name), ' ', 1))) + 2)), '');
  ELSE
    -- Fallback to metadata - use NULL instead of empty string
    v_first_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
    v_last_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  END IF;

  -- Insert profile for new user with waitlist data if available
  -- CRITICAL FIX: Changed from 'active' to 'Trainee' (valid stage value)
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    NEW.email,
    'Trainee'  -- FIXED: was 'active', now uses valid stage
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 1b: Update existing profiles with invalid stage values
UPDATE profiles
SET stage = 'Trainee',
    updated_at = NOW()
WHERE stage = 'active'
   OR stage IS NULL
   OR stage NOT IN ('Trainee', 'Junior', 'Senior', 'Manager', 'Director');

-- ============================================================================
-- Phase 2: Fix name validation issues
-- ============================================================================

-- Step 2a: Clean up existing profiles with empty string names (convert to NULL)
UPDATE profiles
SET first_name = NULL,
    updated_at = NOW()
WHERE first_name IS NOT NULL AND LENGTH(TRIM(first_name)) = 0;

UPDATE profiles
SET last_name = NULL,
    updated_at = NOW()
WHERE last_name IS NOT NULL AND LENGTH(TRIM(last_name)) = 0;

-- Step 2b: Remove profiles with placeholder names from incomplete signups
UPDATE profiles p
SET first_name = NULL,
    last_name = NULL,
    updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id
  AND (
    p.first_name LIKE '[%'
    OR p.last_name LIKE '[%'
    OR au.raw_user_meta_data->>'full_name' LIKE '[%'
  );

-- Step 2c: Add NOT NULL constraints to prevent empty names at database level
-- Note: We allow NULL (for users without names) but not empty strings
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS first_name_not_empty;

ALTER TABLE profiles
ADD CONSTRAINT first_name_not_empty
  CHECK (first_name IS NULL OR LENGTH(TRIM(first_name)) > 0);

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS last_name_not_empty;

ALTER TABLE profiles
ADD CONSTRAINT last_name_not_empty
  CHECK (last_name IS NULL OR LENGTH(TRIM(last_name)) > 0);

-- Add descriptive comments
COMMENT ON CONSTRAINT first_name_not_empty ON profiles IS
  'Ensures first_name is either NULL or a non-empty string (no whitespace-only strings)';

COMMENT ON CONSTRAINT last_name_not_empty ON profiles IS
  'Ensures last_name is either NULL or a non-empty string (no whitespace-only strings)';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_invalid_stage_count INTEGER;
  v_empty_name_count INTEGER;
  v_incomplete_signup_count INTEGER;
BEGIN
  -- Check for remaining invalid stages
  SELECT COUNT(*) INTO v_invalid_stage_count
  FROM profiles
  WHERE stage NOT IN ('Trainee', 'Junior', 'Senior', 'Manager', 'Director');

  IF v_invalid_stage_count > 0 THEN
    RAISE WARNING 'Found % profiles with invalid stages', v_invalid_stage_count;
  ELSE
    RAISE NOTICE 'All profiles have valid stages ✓';
  END IF;

  -- Check for empty string names
  SELECT COUNT(*) INTO v_empty_name_count
  FROM profiles
  WHERE (first_name IS NOT NULL AND LENGTH(TRIM(first_name)) = 0)
     OR (last_name IS NOT NULL AND LENGTH(TRIM(last_name)) = 0);

  IF v_empty_name_count > 0 THEN
    RAISE WARNING 'Found % profiles with empty string names', v_empty_name_count;
  ELSE
    RAISE NOTICE 'No profiles with empty string names ✓';
  END IF;

  -- Check for incomplete signup placeholders
  SELECT COUNT(*) INTO v_incomplete_signup_count
  FROM profiles
  WHERE (first_name LIKE '[%' OR last_name LIKE '[%');

  IF v_incomplete_signup_count > 0 THEN
    RAISE WARNING 'Found % profiles with incomplete signup placeholders', v_incomplete_signup_count;
  ELSE
    RAISE NOTICE 'No profiles with incomplete signup placeholders ✓';
  END IF;

  RAISE NOTICE 'User stage and name validation migration completed successfully';
END;
$$;

-- ============================================================================
-- Migration completed
-- ============================================================================
