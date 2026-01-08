-- =============================================================================
-- Fix HITL Requests Foreign Key to Profiles
-- =============================================================================
-- The hitl_requests table has FKs to auth.users, but PostgREST needs FKs to
-- profiles for the embedded join syntax (profiles:requested_by_user_id) to work.
-- Since profiles.id = auth.users.id, we can safely add the profiles FK.

-- Add foreign key constraint from requested_by_user_id to profiles
-- Note: We keep the auth.users FK for auth-level integrity,
-- but add profiles FK for PostgREST embedded queries
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_requested_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey
    FOREIGN KEY (requested_by_user_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add foreign key constraint from responded_by_user_id to profiles (for join queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_responded_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_responded_by_user_id_profiles_fkey
    FOREIGN KEY (responded_by_user_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add foreign key constraint from assigned_to_user_id to profiles (for join queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_assigned_to_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_assigned_to_user_id_profiles_fkey
    FOREIGN KEY (assigned_to_user_id) REFERENCES profiles(id);
  END IF;
END $$;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey ON hitl_requests
  IS 'Enables PostgREST embedded joins with profiles table via requested_by_user_id';
