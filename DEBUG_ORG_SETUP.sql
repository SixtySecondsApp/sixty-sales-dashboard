-- =====================================================
-- DEBUG: Check Organization Setup Status
-- =====================================================
-- Run this in Supabase SQL Editor to diagnose why org name
-- isn't showing up in onboarding

-- 1. Check if the trigger exists
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%org%' OR proname LIKE '%org%';

-- 2. Check if organizations exist for recent users
SELECT
  p.id as user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.created_at as profile_created,
  o.id as org_id,
  o.name as org_name,
  o.created_at as org_created,
  om.role
FROM profiles p
LEFT JOIN organization_memberships om ON p.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 3. Check the most recent user specifically
SELECT
  p.id as user_id,
  p.email,
  p.first_name,
  p.last_name,
  (SELECT COUNT(*) FROM organization_memberships WHERE user_id = p.id) as membership_count,
  (SELECT o.name FROM organization_memberships om
   JOIN organizations o ON om.org_id = o.id
   WHERE om.user_id = p.id LIMIT 1) as org_name
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 1;

-- 4. List all organizations
SELECT id, name, created_by, created_at, is_active
FROM organizations
ORDER BY created_at DESC
LIMIT 10;

-- 5. List all memberships
SELECT om.*, o.name as org_name, p.email as user_email
FROM organization_memberships om
JOIN organizations o ON om.org_id = o.id
JOIN profiles p ON om.user_id = p.id
ORDER BY om.created_at DESC
LIMIT 10;
