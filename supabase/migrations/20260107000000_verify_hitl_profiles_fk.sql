-- =============================================================================
-- Verify and Create HITL Requests Foreign Keys to Profiles
-- =============================================================================
-- This migration ensures the foreign key relationships exist for PostgREST
-- embedded queries (profiles:requested_by_user_id) to work correctly.

-- Drop existing constraints if they exist (to recreate them properly)
DO $$
BEGIN
  -- Drop FK from requested_by_user_id to profiles if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_requested_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    DROP CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey;
  END IF;
  
  -- Drop FK from responded_by_user_id to profiles if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_responded_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    DROP CONSTRAINT hitl_requests_responded_by_user_id_profiles_fkey;
  END IF;
  
  -- Drop FK from assigned_to_user_id to profiles if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_assigned_to_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    DROP CONSTRAINT hitl_requests_assigned_to_user_id_profiles_fkey;
  END IF;
END $$;

-- Add foreign key constraint from requested_by_user_id to profiles
-- This enables PostgREST embedded queries: profiles:requested_by_user_id(...)
ALTER TABLE hitl_requests
ADD CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey
FOREIGN KEY (requested_by_user_id) REFERENCES profiles(id)
ON DELETE RESTRICT;

-- Add foreign key constraint from responded_by_user_id to profiles
ALTER TABLE hitl_requests
ADD CONSTRAINT hitl_requests_responded_by_user_id_profiles_fkey
FOREIGN KEY (responded_by_user_id) REFERENCES profiles(id)
ON DELETE SET NULL;

-- Add foreign key constraint from assigned_to_user_id to profiles
ALTER TABLE hitl_requests
ADD CONSTRAINT hitl_requests_assigned_to_user_id_profiles_fkey
FOREIGN KEY (assigned_to_user_id) REFERENCES profiles(id)
ON DELETE SET NULL;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey ON hitl_requests
IS 'Foreign key to profiles table for PostgREST embedded queries (profiles:requested_by_user_id)';

COMMENT ON CONSTRAINT hitl_requests_responded_by_user_id_profiles_fkey ON hitl_requests
IS 'Foreign key to profiles table for PostgREST embedded queries (profiles:responded_by_user_id)';

COMMENT ON CONSTRAINT hitl_requests_assigned_to_user_id_profiles_fkey ON hitl_requests
IS 'Foreign key to profiles table for PostgREST embedded queries (profiles:assigned_to_user_id)';
