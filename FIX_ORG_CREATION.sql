-- ============================================================================
-- FIX: Organization Creation for New Users
-- ============================================================================
-- Run this in Supabase Dashboard > SQL Editor
--
-- Issue: New users get "Failed to create organisation" error
-- Root cause: Missing find_orgs_by_email_domain function and RLS policies
-- ============================================================================

-- ============================================================================
-- PART 1: Create the find_orgs_by_email_domain function (missing)
-- ============================================================================

CREATE OR REPLACE FUNCTION find_orgs_by_email_domain(
  p_domain TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    COUNT(DISTINCT om.user_id)::BIGINT as member_count
  FROM organizations o
  INNER JOIN organization_memberships om ON o.id = om.org_id
  INNER JOIN auth.users u ON om.user_id = u.id
  WHERE
    -- Match domain (case-insensitive)
    LOWER(SPLIT_PART(u.email, '@', 2)) = LOWER(p_domain)
    -- Exclude orgs the requesting user is already a member of
    AND o.id NOT IN (
      SELECT org_id FROM organization_memberships WHERE user_id = p_user_id
    )
    -- Only active organizations
    AND o.is_active = true
  GROUP BY o.id, o.name
  -- Only return orgs with at least one member from this domain
  HAVING COUNT(DISTINCT om.user_id) > 0
  ORDER BY COUNT(DISTINCT om.user_id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_orgs_by_email_domain(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_orgs_by_email_domain(TEXT, UUID) TO service_role;

-- ============================================================================
-- PART 2: Ensure organization RLS policies allow creation
-- ============================================================================

-- Helper function: Check if service role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role',
    false
  );
$$;

-- Helper function: Check membership (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = p_user_id
      AND org_id = p_org_id
  );
$$;

-- Helper function: Get user role in org (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_org_role(p_user_id uuid, p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.organization_memberships
  WHERE user_id = p_user_id
    AND org_id = p_org_id
  LIMIT 1;
$$;

-- ============================================================================
-- PART 3: Fix organizations table RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "users_view_member_orgs" ON public.organizations;
DROP POLICY IF EXISTS "users_create_own_org" ON public.organizations;

-- SELECT: Users can see orgs they belong to OR created
CREATE POLICY "organizations_select"
  ON public.organizations
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_org_member(auth.uid(), id)
    OR created_by = auth.uid()
  );

-- INSERT: Any authenticated user can create an org
CREATE POLICY "organizations_insert"
  ON public.organizations
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR auth.uid() IS NOT NULL
  );

-- ============================================================================
-- PART 4: Fix organization_memberships table RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "organization_memberships_select" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_insert" ON public.organization_memberships;

-- SELECT: Users can see their own memberships or memberships in orgs they're in
CREATE POLICY "organization_memberships_select"
  ON public.organization_memberships
  FOR SELECT
  USING (
    public.is_service_role()
    OR user_id = auth.uid()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

-- INSERT: Users can add themselves as owner to orgs they created, or join as member
CREATE POLICY "organization_memberships_insert"
  ON public.organization_memberships
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    -- User adding themselves as owner to org they created
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = org_id
          AND o.created_by = auth.uid()
      )
    )
    -- User joining as member
    OR (
      user_id = auth.uid()
      AND role = 'member'
    )
    -- Org owners/admins can add members
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

-- ============================================================================
-- PART 5: Ensure handle_new_user trigger exists for auto org creation
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 6: Ensure auto_create_org_for_new_user trigger exists
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Check if user already has an organization membership
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get user's email
  SELECT COALESCE(au.email, NEW.email) INTO v_user_email
  FROM auth.users au
  WHERE au.id = NEW.id;

  IF v_user_email IS NULL THEN
    v_user_email := NEW.email;
  END IF;

  -- Generate org name
  IF (NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0) OR
     (NEW.last_name IS NOT NULL AND LENGTH(TRIM(NEW.last_name)) > 0) THEN
    v_org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  v_org_name := TRIM(v_org_name);
  IF v_org_name = '''s Organization' OR v_org_name = '' THEN
    v_org_name := 'My Organization';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
  VALUES (v_org_name, NEW.id, true, NOW(), NOW())
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

  RAISE NOTICE 'Created organization "%" for user %', v_org_name, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'auto_create_org_for_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  func_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  -- Check find_orgs_by_email_domain
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_orgs_by_email_domain'
  ) INTO func_exists;

  IF func_exists THEN
    RAISE NOTICE '✓ find_orgs_by_email_domain function exists';
  ELSE
    RAISE WARNING '✗ find_orgs_by_email_domain function MISSING';
  END IF;

  -- Check auto_create_org_for_new_user
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'auto_create_org_for_new_user'
  ) INTO func_exists;

  IF func_exists THEN
    RAISE NOTICE '✓ auto_create_org_for_new_user function exists';
  ELSE
    RAISE WARNING '✗ auto_create_org_for_new_user function MISSING';
  END IF;

  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_org_for_new_user'
  ) INTO trigger_exists;

  IF trigger_exists THEN
    RAISE NOTICE '✓ trigger_auto_org_for_new_user trigger exists';
  ELSE
    RAISE WARNING '✗ trigger_auto_org_for_new_user trigger MISSING';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organization creation fix applied!';
  RAISE NOTICE 'New users should now be able to create organizations.';
  RAISE NOTICE '========================================';
END;
$$;
