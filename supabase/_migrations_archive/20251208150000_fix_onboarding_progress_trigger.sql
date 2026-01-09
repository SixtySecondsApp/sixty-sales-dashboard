-- ============================================================================
-- Migration: Fix Onboarding Progress Trigger for New Users
-- ============================================================================
-- Issue: New users don't get onboarding_progress record created
-- Root Cause: The trigger function lacks SECURITY DEFINER to bypass RLS
--
-- Solution: Recreate the trigger function with SECURITY DEFINER and proper
-- error handling so it can insert records even when RLS is enabled.
-- ============================================================================

-- ============================================================================
-- Step 1: Fix the create_onboarding_progress_for_new_user function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_onboarding_progress_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create onboarding progress record for new user
  INSERT INTO public.user_onboarding_progress (user_id, onboarding_step)
  VALUES (NEW.id, 'welcome')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the profile creation
  RAISE WARNING 'create_onboarding_progress_for_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_onboarding_progress_for_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION create_onboarding_progress_for_new_user() TO postgres;

-- ============================================================================
-- Step 2: Ensure the trigger exists on profiles table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_create_onboarding_progress ON profiles;
CREATE TRIGGER trigger_create_onboarding_progress
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_onboarding_progress_for_new_user();

-- ============================================================================
-- Step 3: Ensure RLS policy allows the trigger to insert
-- ============================================================================

-- Enable RLS on the table (if not already)
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Allow postgres and service_role to insert (for triggers)
DROP POLICY IF EXISTS "allow_trigger_insert_onboarding" ON user_onboarding_progress;
CREATE POLICY "allow_trigger_insert_onboarding" ON user_onboarding_progress
  FOR INSERT
  TO postgres, service_role
  WITH CHECK (true);

-- Allow users to view their own onboarding progress
DROP POLICY IF EXISTS "users_view_own_onboarding" ON user_onboarding_progress;
CREATE POLICY "users_view_own_onboarding" ON user_onboarding_progress
  FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow users to update their own onboarding progress
DROP POLICY IF EXISTS "users_update_own_onboarding" ON user_onboarding_progress;
CREATE POLICY "users_update_own_onboarding" ON user_onboarding_progress
  FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow users to insert their own onboarding progress (fallback for manual creation)
DROP POLICY IF EXISTS "users_insert_own_onboarding" ON user_onboarding_progress;
CREATE POLICY "users_insert_own_onboarding" ON user_onboarding_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Grant table permissions
GRANT ALL ON user_onboarding_progress TO postgres;
GRANT ALL ON user_onboarding_progress TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_onboarding_progress TO authenticated;

-- ============================================================================
-- Step 4: Verification
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  -- Check trigger exists
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_onboarding_progress'
  ) INTO v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE WARNING 'trigger_create_onboarding_progress trigger does not exist!';
  ELSE
    RAISE NOTICE 'trigger_create_onboarding_progress trigger exists ✓';
  END IF;

  -- Check function exists
  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'create_onboarding_progress_for_new_user'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE WARNING 'create_onboarding_progress_for_new_user function does not exist!';
  ELSE
    RAISE NOTICE 'create_onboarding_progress_for_new_user function exists ✓';
  END IF;

  RAISE NOTICE 'Onboarding progress trigger fix migration completed successfully';
END;
$$;
