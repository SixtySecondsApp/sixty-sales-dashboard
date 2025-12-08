-- ============================================================================
-- Seed Script: Clerk User Mapping
-- ============================================================================
-- Purpose: Populate clerk_user_mapping table with existing Supabase users
--
-- This script should be run on BOTH projects:
-- 1. Internal project (ewtuefzeogytgmsnkpmb)
-- 2. External project (cregubixyglvfzvtlgit)
--
-- IMPORTANT: Before running this script, you need to:
-- 1. Create users in Clerk (https://clerk.com/docs/users/creating-users)
-- 2. Get each Clerk user ID from Clerk Dashboard → Users
-- 3. Update the INSERT statements below with the correct clerk_user_id values
-- ============================================================================

-- ============================================================================
-- Step 1: View existing users to understand what needs to be mapped
-- ============================================================================

-- Run this query to see all users that need Clerk IDs:
SELECT
    p.id as supabase_user_id,
    p.email,
    p.name as full_name,
    p.is_admin,
    p.created_at
FROM profiles p
ORDER BY p.created_at;

-- ============================================================================
-- Step 2: Insert mappings (update with actual Clerk user IDs)
-- ============================================================================

-- TEMPLATE: Copy and modify these INSERT statements with actual Clerk user IDs
-- Get Clerk user IDs from: Clerk Dashboard → Users → Click user → Copy user ID

-- INSERT INTO clerk_user_mapping (supabase_user_id, clerk_user_id, email)
-- VALUES
--     ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'user_xxxxxxxxxxxxxxxxxxxx', 'user@example.com');

-- ============================================================================
-- Step 3: Automated mapping (if Clerk users have same email as Supabase)
-- ============================================================================

-- If you've already created Clerk users with matching emails, you can use
-- Clerk's API to look them up by email and create mappings programmatically.
-- See: https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUserList

-- ============================================================================
-- Step 4: Verification queries
-- ============================================================================

-- Check which users have been mapped:
SELECT
    p.email,
    p.name,
    p.is_admin,
    cum.clerk_user_id,
    CASE WHEN cum.clerk_user_id IS NOT NULL THEN 'Mapped' ELSE 'Not Mapped' END as status
FROM profiles p
LEFT JOIN clerk_user_mapping cum ON cum.supabase_user_id = p.id
ORDER BY status, p.email;

-- Count of mapped vs unmapped users:
SELECT
    COUNT(*) FILTER (WHERE cum.clerk_user_id IS NOT NULL) as mapped_users,
    COUNT(*) FILTER (WHERE cum.clerk_user_id IS NULL) as unmapped_users,
    COUNT(*) as total_users
FROM profiles p
LEFT JOIN clerk_user_mapping cum ON cum.supabase_user_id = p.id;

-- ============================================================================
-- Step 5: Function to provision users automatically (optional)
-- ============================================================================

-- This function can be called from an Edge Function or migration to create
-- Clerk user mappings for new users. It's already created by 002_clerk_auth.sql

-- Usage: SELECT provision_clerk_user('clerk_user_id', 'email@example.com', 'Full Name');

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- To remove all mappings and start fresh:
-- TRUNCATE TABLE clerk_user_mapping;
