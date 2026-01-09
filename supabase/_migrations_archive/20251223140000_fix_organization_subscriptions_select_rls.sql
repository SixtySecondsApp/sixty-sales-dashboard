-- ============================================================================
-- Migration: Fix Organization Subscriptions SELECT RLS Policy
-- ============================================================================
-- Problem: Platform admins cannot see subscription data in nested SELECT queries
-- from the SaaS Admin UI. The current SELECT policy only allows service_role
-- or is_admin_optimized(), but nested SELECTs may have different context evaluation.
--
-- Fix: Add explicit org membership check and ensure platform admins can access all data.
-- ============================================================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "organization_subscriptions_select" ON organization_subscriptions;

-- Create comprehensive SELECT policy
-- Allows:
-- 1. Service role (for backend operations, edge functions, webhooks)
-- 2. Platform admins (for SaaS Admin UI access)
-- 3. Org members (for viewing their own organization's subscription)
CREATE POLICY "organization_subscriptions_select" ON organization_subscriptions
FOR SELECT USING (
  -- Service role can always select (for system operations)
  is_service_role()
  -- Platform admins can view all subscriptions via SaaS Admin UI
  OR is_admin_optimized()
  -- Org members can view their own organization's subscription
  OR is_org_member(auth.uid(), org_id)
);

-- Verify helper functions exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_admin_optimized'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'is_admin_optimized function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_org_member'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'is_org_member function not found';
  END IF;

  RAISE NOTICE 'organization_subscriptions SELECT RLS policy fixed successfully';
END;
$$;
