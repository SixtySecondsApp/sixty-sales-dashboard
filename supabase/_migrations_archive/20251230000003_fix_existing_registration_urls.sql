-- ============================================================================
-- Migration: Fix Existing Registration URLs (Strip Query Parameters)
-- ============================================================================
-- Fix: Clean up existing registration URLs that have query parameters
-- This retroactively applies the normalization rules to old records
--
-- Note: This only strips query parameters. Incomplete signup placeholders
-- (like '[Incomplete Signup]') cannot be easily fixed retroactively.
-- ============================================================================

-- Step 1: Fix URLs with query parameters (e.g., /waitlist?fbclid=... → /waitlist)
UPDATE meetings_waitlist
SET registration_url = SPLIT_PART(registration_url, '?', 1),
    updated_at = NOW()
WHERE registration_url IS NOT NULL
  AND registration_url LIKE '%?%'
  AND NOT registration_url LIKE 'partial:%';  -- Don't touch partial: URLs

-- Step 2: Fix malformed URLs that might have lost the query string delimiter
-- (e.g., /waitlistTutm_medium=... where the ? got corrupted)
UPDATE meetings_waitlist
SET registration_url = REGEXP_SUBSTR(registration_url, '^[^&]+'),
    updated_at = NOW()
WHERE registration_url IS NOT NULL
  AND registration_url LIKE '/waitlist%'
  AND (registration_url LIKE '%&%' OR registration_url LIKE '%utm_%')
  AND registration_url NOT LIKE '%?%'
  AND NOT registration_url LIKE 'partial:%';

-- Step 3: Verify the cleanup
DO $$
DECLARE
  v_urls_with_query_params INTEGER;
  v_malformed_urls INTEGER;
BEGIN
  -- Check for any remaining query parameters (except partial: URLs)
  SELECT COUNT(*) INTO v_urls_with_query_params
  FROM meetings_waitlist
  WHERE registration_url IS NOT NULL
    AND registration_url LIKE '%?%'
    AND NOT registration_url LIKE 'partial:%';

  -- Check for any remaining malformed URLs with utm params (except partial: URLs)
  SELECT COUNT(*) INTO v_malformed_urls
  FROM meetings_waitlist
  WHERE registration_url IS NOT NULL
    AND registration_url LIKE '/waitlist%'
    AND (registration_url LIKE '%&%' OR registration_url LIKE '%utm_%')
    AND NOT registration_url LIKE '%?%'
    AND NOT registration_url LIKE 'partial:%';

  IF v_urls_with_query_params > 0 THEN
    RAISE WARNING 'Found % remaining URLs with query parameters', v_urls_with_query_params;
  ELSE
    RAISE NOTICE 'All query parameters stripped successfully ✓';
  END IF;

  IF v_malformed_urls > 0 THEN
    RAISE WARNING 'Found % remaining malformed URLs', v_malformed_urls;
  ELSE
    RAISE NOTICE 'All malformed URLs cleaned up ✓';
  END IF;

  RAISE NOTICE 'Existing registration URL cleanup completed successfully';
END;
$$;

-- ============================================================================
-- Migration completed
-- ============================================================================
