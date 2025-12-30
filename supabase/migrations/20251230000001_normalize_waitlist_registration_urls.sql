-- ============================================================================
-- Migration: Normalize Waitlist Registration URLs
-- ============================================================================
-- Issue: Waitlist registration_url column stores full domain URLs like
-- https://www.use60.com/waitlist?ref=MEET-ABC instead of just paths like
-- /waitlist (without query parameters)
--
-- This migration:
-- 1. Normalizes existing URLs to path-only format (strips query params)
-- 2. Updates invalid/malformed URLs to NULL
-- 3. Adds comment clarifying the expected format
-- ============================================================================

-- Update existing registration URLs to path-only format (without query params)
UPDATE meetings_waitlist
SET registration_url =
  CASE
    -- If URL starts with http/https, extract just the path (no query string)
    WHEN registration_url LIKE 'http://%' OR registration_url LIKE 'https://%' THEN
      -- Extract path from full URL and remove query parameters
      SPLIT_PART(
        SUBSTRING(
          registration_url,
          POSITION('/' IN SUBSTRING(registration_url, 9)) + 8  -- +8 to skip "https://" or similar
        ),
        '?',  -- Split on query string delimiter
        1     -- Keep only the path part
      )
    -- If already a path (starts with /), remove query parameters
    WHEN registration_url LIKE '/%' THEN
      SPLIT_PART(registration_url, '?', 1)
    -- If empty or whitespace, convert to NULL
    WHEN registration_url IS NULL OR TRIM(registration_url) = '' THEN
      NULL
    -- For any other invalid format, set to NULL
    ELSE
      NULL
  END,
  updated_at = NOW()
WHERE registration_url IS NOT NULL
  AND (
    registration_url LIKE 'http://%'
    OR registration_url LIKE 'https://%'
    OR (registration_url IS NOT NULL AND NOT registration_url LIKE '/%')
    OR registration_url LIKE '%?%'  -- Also update any paths with query parameters
  );

-- Add comment clarifying the format
COMMENT ON COLUMN meetings_waitlist.registration_url IS
  'Pathname only, without domain, protocol, or query parameters (e.g., /waitlist).
   Used for analytics and tracking entry points.
   Format: /[path] or NULL if not available';

-- Verify the normalization
DO $$
DECLARE
  v_full_urls_remaining INTEGER;
  v_query_params_remaining INTEGER;
  v_invalid_urls_remaining INTEGER;
BEGIN
  -- Check for any remaining full URLs
  SELECT COUNT(*) INTO v_full_urls_remaining
  FROM meetings_waitlist
  WHERE registration_url IS NOT NULL
    AND (registration_url LIKE 'http://%' OR registration_url LIKE 'https://%');

  -- Check for any remaining query parameters
  SELECT COUNT(*) INTO v_query_params_remaining
  FROM meetings_waitlist
  WHERE registration_url IS NOT NULL
    AND registration_url LIKE '%?%';

  -- Check for any remaining non-path URLs (that don't start with /)
  SELECT COUNT(*) INTO v_invalid_urls_remaining
  FROM meetings_waitlist
  WHERE registration_url IS NOT NULL
    AND NOT registration_url LIKE '/%';

  IF v_full_urls_remaining > 0 THEN
    RAISE WARNING 'Found % remaining full URLs after normalization', v_full_urls_remaining;
  ELSE
    RAISE NOTICE 'All full URLs successfully normalized ✓';
  END IF;

  IF v_query_params_remaining > 0 THEN
    RAISE WARNING 'Found % remaining URLs with query parameters', v_query_params_remaining;
  ELSE
    RAISE NOTICE 'All query parameters stripped successfully ✓';
  END IF;

  IF v_invalid_urls_remaining > 0 THEN
    RAISE WARNING 'Found % remaining invalid URLs after normalization', v_invalid_urls_remaining;
  ELSE
    RAISE NOTICE 'All invalid URLs cleaned up ✓';
  END IF;

  RAISE NOTICE 'Waitlist registration URL normalization completed successfully';
END;
$$;

-- ============================================================================
-- Migration completed
-- ============================================================================
