-- ============================================================================
-- Migration: Use Waitlist Company Name for Organization Creation
-- ============================================================================
-- Updates the auto_create_org_for_new_user function to:
-- 1. Use company_name from waitlist entry if available
-- 2. Normalize organization names to prevent duplicates
-- 3. Check for similar organization names and reuse existing ones
-- ============================================================================

-- Function to normalize organization name
-- Handles case-insensitive matching, extra spaces, etc.
CREATE OR REPLACE FUNCTION normalize_org_name(raw_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Trim whitespace
  raw_name := TRIM(raw_name);
  
  -- Return empty string if input is null or empty
  IF raw_name IS NULL OR LENGTH(raw_name) = 0 THEN
    RETURN '';
  END IF;
  
  -- Convert to lowercase for comparison, but return properly capitalized
  -- Remove extra spaces
  raw_name := regexp_replace(raw_name, '\s+', ' ', 'g');
  
  -- Capitalize first letter of each word
  raw_name := INITCAP(raw_name);
  
  RETURN raw_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar organization name (case-insensitive, normalized)
CREATE OR REPLACE FUNCTION find_similar_org_name(normalized_name TEXT)
RETURNS UUID AS $$
DECLARE
  similar_org_id UUID;
BEGIN
  -- Find organization with similar normalized name
  -- Uses case-insensitive comparison and handles variations
  SELECT id INTO similar_org_id
  FROM organizations
  WHERE LOWER(TRIM(name)) = LOWER(normalized_name)
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN similar_org_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Updated function to create organization using waitlist company_name
CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
  v_waitlist_company_name TEXT;
  v_normalized_name TEXT;
  v_existing_org_id UUID;
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

  -- Determine organization name
  IF v_waitlist_company_name IS NOT NULL AND LENGTH(TRIM(v_waitlist_company_name)) > 0 THEN
    -- Use company name from waitlist
    v_org_name := normalize_org_name(v_waitlist_company_name);
  ELSIF (NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0) OR
        (NEW.last_name IS NOT NULL AND LENGTH(TRIM(NEW.last_name)) > 0) THEN
    -- Fallback to user's name
    v_org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    -- Fallback to email domain
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
    -- Create new organization with normalized name
    INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
    VALUES (v_org_name, NEW.id, true, NOW(), NOW())
    RETURNING id INTO v_org_id;

    -- Add user as owner of the organization
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

    RAISE NOTICE 'Created organization "%" (id: %) for user %', v_org_name, v_org_id, NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail signup
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION auto_create_org_for_new_user() IS
  'Automatically creates or links user to organization when profile is created. Uses company_name from waitlist if available, normalizes names to prevent duplicates, and reuses similar organization names.';

COMMENT ON FUNCTION normalize_org_name(TEXT) IS
  'Normalizes organization names by trimming whitespace, removing extra spaces, and capitalizing properly.';

COMMENT ON FUNCTION find_similar_org_name(TEXT) IS
  'Finds existing organization with similar normalized name (case-insensitive) to prevent duplicates.';
