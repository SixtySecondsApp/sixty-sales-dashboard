-- Check Email Matches - See if contacts exist with matching emails

-- Check 1: How many deals have emails that match contacts?
DO $$
DECLARE
  matching_count INTEGER;
  total_deals INTEGER;
BEGIN
  RAISE NOTICE '=== EMAIL MATCH ANALYSIS ===';

  SELECT COUNT(*) INTO total_deals
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  RAISE NOTICE 'Deals with valid emails: %', total_deals;

  SELECT COUNT(DISTINCT d.id) INTO matching_count
  FROM deals d
  INNER JOIN contacts c ON LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
  WHERE d.contact_email IS NOT NULL
    AND d.contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  RAISE NOTICE 'Deals with matching contacts: %', matching_count;
  RAISE NOTICE 'Match rate: %.1f%%', (matching_count::FLOAT / total_deals * 100);

  IF matching_count = 0 THEN
    RAISE WARNING '❌ NO MATCHES FOUND - Contacts have different emails than deals!';
  END IF;
END $$;

-- Check 2: Sample of deals and their potential matches
DO $$
DECLARE
  r RECORD;
  match_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== SAMPLE EMAIL MATCHES ===';

  FOR r IN
    SELECT
      d.id as deal_id,
      d.contact_email as deal_email,
      c.id as contact_id,
      c.email as contact_email,
      c.company_id
    FROM deals d
    INNER JOIN contacts c ON LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
    WHERE d.company_id IS NULL
      AND d.contact_email IS NOT NULL
    LIMIT 5
  LOOP
    match_count := match_count + 1;
    RAISE NOTICE 'Deal: % | Deal email: % | Contact: % | Contact email: % | Company: %',
                 r.deal_id, r.deal_email, r.contact_id, r.contact_email, r.company_id;
  END LOOP;

  IF match_count = 0 THEN
    RAISE WARNING 'No matching emails found in sample';
  ELSE
    RAISE NOTICE 'Found % matches in sample', match_count;
  END IF;
END $$;

-- Check 3: Sample of contact emails vs deal emails
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== CONTACT EMAIL SAMPLE ===';

  FOR r IN
    SELECT email FROM contacts LIMIT 5
  LOOP
    RAISE NOTICE 'Contact email: %', r.email;
  END LOOP;

  RAISE NOTICE '=== DEAL EMAIL SAMPLE ===';

  FOR r IN
    SELECT contact_email FROM deals WHERE contact_email IS NOT NULL LIMIT 5
  LOOP
    RAISE NOTICE 'Deal email: %', r.contact_email;
  END LOOP;
END $$;
