-- Add company_domain support to standard sign-up flow
-- Allows users to provide their company domain during sign-up
-- Prevents Gmail domain scanning and improves onboarding experience
--
-- Changes:
-- 1. Update auto_create_org_for_new_user() to extract company_domain from auth.users metadata
-- 2. Set organizations.company_domain during organization creation
-- 3. Prioritize user-provided company_domain over email domain extraction

-- ============================================================================
-- 1. Update auto_create_org_for_new_user() trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."auto_create_org_for_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
  v_company_domain TEXT;
  v_waitlist_company_name TEXT;
  v_normalized_name TEXT;
  v_existing_org_id UUID;
  v_is_personal_email BOOLEAN;
  v_user_metadata JSONB;
BEGIN
  -- Check if user already has an organization membership
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get user's email from auth.users or profile
  SELECT COALESCE(au.email, NEW.email) INTO v_user_email
  FROM auth.users au
  WHERE au.id = NEW.id;

  -- Fallback to profile email if auth.users lookup fails
  IF v_user_email IS NULL THEN
    v_user_email := NEW.email;
  END IF;

  -- Extract company_domain from auth.users.raw_user_meta_data if provided during sign-up
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = NEW.id;

  IF v_user_metadata IS NOT NULL THEN
    v_company_domain := TRIM(COALESCE(v_user_metadata->>'company_domain', ''));
    -- Clear if empty string
    IF v_company_domain = '' THEN
      v_company_domain := NULL;
    END IF;
  END IF;

  -- Try to get company_name from waitlist entry by email (user_id might not be linked yet)
  -- Check both by user_id (if already linked) and by email (for new signups)
  SELECT company_name INTO v_waitlist_company_name
  FROM meetings_waitlist
  WHERE (user_id = NEW.id OR LOWER(email) = LOWER(v_user_email))
    AND company_name IS NOT NULL
    AND TRIM(company_name) != ''
  ORDER BY
    CASE WHEN user_id = NEW.id THEN 1 ELSE 2 END, -- Prefer linked entries
    created_at ASC
  LIMIT 1;

  -- Check if user's email is a personal email domain
  -- This check happens BEFORE org creation logic
  v_is_personal_email := is_personal_email_domain(v_user_email);

  -- If personal email AND no company name from waitlist AND no user-provided domain, skip org creation
  -- This defers org creation to OnboardingV2 after collecting company info
  IF v_is_personal_email AND (v_waitlist_company_name IS NULL OR TRIM(v_waitlist_company_name) = '') AND (v_company_domain IS NULL OR TRIM(v_company_domain) = '') THEN
    RAISE NOTICE 'Skipping org creation for personal email domain: % - deferred to onboarding', v_user_email;
    RETURN NEW;
  END IF;

  -- Determine organization name (only reached if NOT skipping)
  IF v_waitlist_company_name IS NOT NULL AND LENGTH(TRIM(v_waitlist_company_name)) > 0 THEN
    -- Use company name from waitlist
    v_org_name := normalize_org_name(v_waitlist_company_name);
  ELSIF (NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0) OR
        (NEW.last_name IS NOT NULL AND LENGTH(TRIM(NEW.last_name)) > 0) THEN
    -- Fallback to user's name
    v_org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    -- Fallback to email domain (only for corporate emails, since personal emails are already skipped)
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Clean up the name
  v_org_name := TRIM(v_org_name);
  IF v_org_name = '''s Organization' OR v_org_name = '' THEN
    v_org_name := 'My Organization';
  END IF;

  -- Normalize the name for comparison
  v_normalized_name := normalize_org_name(v_org_name);

  -- Check if an organization with similar name already exists
  v_existing_org_id := find_similar_org_name(v_normalized_name);

  IF v_existing_org_id IS NOT NULL THEN
    -- Reuse existing organization
    v_org_id := v_existing_org_id;

    -- Add user as member of existing organization (as owner if they're the first member, otherwise as member)
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (
      v_org_id,
      NEW.id,
      CASE WHEN (SELECT COUNT(*) FROM organization_memberships WHERE org_id = v_org_id) = 0 THEN 'owner' ELSE 'member' END,
      NOW(),
      NOW()
    )
    ON CONFLICT (org_id, user_id) DO NOTHING;

    RAISE NOTICE 'User % added to existing organization "%" (id: %)', NEW.id, v_org_name, v_org_id;
  ELSE
    -- Create new organization with normalized name and company_domain (if provided)
    INSERT INTO organizations (name, created_by, is_active, company_domain, created_at, updated_at)
    VALUES (v_org_name, NEW.id, true, v_company_domain, NOW(), NOW())
    RETURNING id INTO v_org_id;

    -- Add user as owner of the organization
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

    RAISE NOTICE 'Created organization "%" (id: %) for user % with company_domain: %', v_org_name, v_org_id, NEW.id, v_company_domain;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail signup
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."auto_create_org_for_new_user"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."auto_create_org_for_new_user"() IS
'Automatically creates or links user to organization when profile is created.
Extracts company_domain from sign-up metadata if provided.
Skips org creation for personal email domains (Gmail, Yahoo, etc.) - defers to onboarding.
Uses company_name from waitlist if available, normalizes names to prevent duplicates, and reuses similar organization names.
Corporate emails and waitlist users with company names get org created immediately.';
