-- ============================================================================
-- Migration: Fix Organization Subscriptions RLS Policy
-- ============================================================================
-- Problem: INSERT and UPDATE policies only allow service_role, blocking
-- platform admins from managing subscriptions via the SaaS Admin UI.
--
-- Fix: Allow platform admins to create and update subscriptions.
-- ============================================================================

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "organization_subscriptions_insert" ON organization_subscriptions;

-- Create new INSERT policy that allows platform admins
CREATE POLICY "organization_subscriptions_insert" ON organization_subscriptions
FOR INSERT WITH CHECK (
  -- Service role can always insert (for Stripe webhooks, system operations)
  is_service_role()
  -- Platform admins can create subscriptions via SaaS Admin UI
  OR is_admin_optimized()
);

-- Drop the overly restrictive UPDATE policy
DROP POLICY IF EXISTS "organization_subscriptions_update" ON organization_subscriptions;

-- Create new UPDATE policy that allows platform admins
CREATE POLICY "organization_subscriptions_update" ON organization_subscriptions
FOR UPDATE USING (
  -- Service role can always update (for Stripe webhooks, system operations)
  is_service_role()
  -- Platform admins can update subscriptions via SaaS Admin UI
  OR is_admin_optimized()
);

-- Verify the helper function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_admin_optimized'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'is_admin_optimized function not found - please ensure admin helper functions migration has been run';
  END IF;

  RAISE NOTICE 'organization_subscriptions RLS policies fixed successfully';
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON organization_subscriptions TO authenticated;
