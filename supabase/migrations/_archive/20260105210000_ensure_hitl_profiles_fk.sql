-- =============================================================================
-- Ensure HITL Requests Foreign Key to Profiles exists
-- =============================================================================
-- Safely adds the foreign key constraint if it doesn't already exist

DO $$
BEGIN
  -- Check and add foreign key from requested_by_user_id to profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_requested_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_requested_by_user_id_profiles_fkey
    FOREIGN KEY (requested_by_user_id) REFERENCES profiles(id);
    
    RAISE NOTICE 'Added hitl_requests_requested_by_user_id_profiles_fkey constraint';
  ELSE
    RAISE NOTICE 'hitl_requests_requested_by_user_id_profiles_fkey already exists, skipping';
  END IF;
  
  -- Check and add foreign key from responded_by_user_id to profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_responded_by_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_responded_by_user_id_profiles_fkey
    FOREIGN KEY (responded_by_user_id) REFERENCES profiles(id);
    
    RAISE NOTICE 'Added hitl_requests_responded_by_user_id_profiles_fkey constraint';
  ELSE
    RAISE NOTICE 'hitl_requests_responded_by_user_id_profiles_fkey already exists, skipping';
  END IF;
  
  -- Check and add foreign key from assigned_to_user_id to profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hitl_requests_assigned_to_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE hitl_requests
    ADD CONSTRAINT hitl_requests_assigned_to_user_id_profiles_fkey
    FOREIGN KEY (assigned_to_user_id) REFERENCES profiles(id);
    
    RAISE NOTICE 'Added hitl_requests_assigned_to_user_id_profiles_fkey constraint';
  ELSE
    RAISE NOTICE 'hitl_requests_assigned_to_user_id_profiles_fkey already exists, skipping';
  END IF;
END $$;
