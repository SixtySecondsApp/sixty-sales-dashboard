-- ============================================================================
-- CLERK USER MIGRATION SCRIPT
-- ============================================================================
-- This script helps migrate all existing Supabase Auth users to Clerk
-- 
-- STEP 1: Run this query to see all existing users that need migration
-- STEP 2: Create matching users in Clerk Dashboard (or via Clerk API)
-- STEP 3: Run the INSERT statements with the Clerk user IDs
-- ============================================================================

-- STEP 1: List all existing Supabase users
SELECT 
  id as supabase_user_id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at;

-- STEP 2: Check which users already have clerk mappings
SELECT 
  u.id as supabase_user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  cm.clerk_user_id,
  CASE WHEN cm.clerk_user_id IS NULL THEN 'NEEDS MAPPING' ELSE 'MAPPED' END as status
FROM auth.users u
LEFT JOIN clerk_user_mapping cm ON cm.supabase_user_id = u.id
ORDER BY status DESC, u.created_at;

-- ============================================================================
-- STEP 3: After creating users in Clerk, run INSERT statements like this:
-- ============================================================================
-- 
-- INSERT INTO clerk_user_mapping (clerk_user_id, supabase_user_id, email)
-- VALUES 
--   ('user_CLERK_ID_1', 'supabase-uuid-1', 'user1@example.com'),
--   ('user_CLERK_ID_2', 'supabase-uuid-2', 'user2@example.com'),
--   ('user_CLERK_ID_3', 'supabase-uuid-3', 'user3@example.com')
-- ON CONFLICT (clerk_user_id) DO UPDATE SET
--   supabase_user_id = EXCLUDED.supabase_user_id,
--   email = EXCLUDED.email,
--   updated_at = NOW();
-- ============================================================================

