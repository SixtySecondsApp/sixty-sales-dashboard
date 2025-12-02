-- =====================================================
-- RESEED WAITLIST WITH POINTS SYSTEM (0-87 points)
-- =====================================================
-- Points breakdown:
-- - Email referral: 5 points each
-- - LinkedIn share: 50 points (one-time)
-- - Range: 0-87 points
--   - Example: 1 LinkedIn (50) + 7 referrals (35) = 85 points
--   - Example: 17 referrals (85) + 0 LinkedIn = 85 points
--   - Max: 1 LinkedIn (50) + 7 referrals (35) = 85 points (can't exceed 87 in realistic scenarios)

-- Step 1: Temporarily disable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 2: Delete all fake entries (keep real users)
DELETE FROM meetings_waitlist
WHERE email NOT LIKE '%@sixtyseconds.video';

-- Step 3: Reset positions for real users
WITH ranked_real_users AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_position
  FROM meetings_waitlist
  WHERE email LIKE '%@sixtyseconds.video'
)
UPDATE meetings_waitlist
SET
  signup_position = ranked_real_users.new_position,
  total_points = (COALESCE(referral_count, 0) * 5) + (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END),
  effective_position = GREATEST(1, ranked_real_users.new_position - ((COALESCE(referral_count, 0) * 5) + (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END)))
FROM ranked_real_users
WHERE meetings_waitlist.id = ranked_real_users.id;

-- Step 4: Seed 263 fake users with points ranging 0-87
DO $$
DECLARE
  i INTEGER;
  first_names TEXT[] := ARRAY['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah'];
  last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];
  companies TEXT[] := ARRAY['Salesforce', 'HubSpot', 'Zoom', 'Slack', 'DocuSign', 'Asana', 'Notion', 'Figma', 'Canva', 'Stripe', 'Square', 'Shopify', 'Mailchimp', 'Zendesk', 'Intercom', 'Atlassian', 'Monday.com', 'Airtable', 'Miro', 'Loom', 'Calendly', 'Zapier', 'Dropbox', 'Box', 'Twilio', 'SendGrid', 'Segment', 'Amplitude', 'Mixpanel', 'Datadog', 'PagerDuty', 'Okta', 'Auth0', 'Cloudflare', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean', 'MongoDB', 'Redis Labs'];
  profile_images TEXT[] := ARRAY['/profiles/linkedin profile 1.png', '/profiles/linkedin profile 2.png', '/profiles/linkedin profile 4.png', '/profiles/linkedin profile 5.png', '/profiles/lnkedin 6.png'];

  random_first TEXT;
  random_last TEXT;
  random_company TEXT;
  random_profile TEXT;
  random_email TEXT;
  random_code TEXT;
  current_max_position INTEGER;
BEGIN
  -- Get the current max position from real users
  SELECT COALESCE(MAX(signup_position), 0) INTO current_max_position
  FROM meetings_waitlist;

  FOR i IN 1..263 LOOP
    DECLARE
      random_points INTEGER;
      has_linkedin BOOLEAN;
      random_referrals INTEGER;
      base_signup_position INTEGER;
      calculated_position INTEGER;
    BEGIN
      -- Generate random data
      random_first := first_names[1 + floor(random() * array_length(first_names, 1))];
      random_last := last_names[1 + floor(random() * array_length(last_names, 1))];
      random_company := companies[1 + floor(random() * array_length(companies, 1))];
      random_profile := profile_images[1 + floor(random() * array_length(profile_images, 1))];
      random_email := lower(random_first || '.' || random_last || floor(random() * 1000)::text || '@' || replace(lower(random_company), ' ', '') || '.com');
      random_code := 'MEET-' || upper(substring(md5(random()::text) from 1 for 6));

      -- Generate random total points (0-87) with weighted distribution
      random_points := CASE
        WHEN random() < 0.60 THEN floor(random() * 16)::INTEGER  -- 60%: 0-15 points (0-3 referrals)
        WHEN random() < 0.80 THEN floor(random() * 36)::INTEGER  -- 20%: 0-35 points (0-7 referrals)
        WHEN random() < 0.93 THEN floor(random() * 61)::INTEGER  -- 13%: 0-60 points (LinkedIn + referrals)
        ELSE floor(random() * 88)::INTEGER                        -- 7%: 0-87 points (max)
      END;

      -- Determine if they have LinkedIn boost (50 points)
      -- If points >= 50, they likely have LinkedIn boost
      has_linkedin := random_points >= 50 AND random() < 0.7;

      -- Calculate referral count based on remaining points
      IF has_linkedin THEN
        random_referrals := LEAST(floor((random_points - 50) / 5.0)::INTEGER, 7);  -- Max 7 referrals with LinkedIn
        random_points := (random_referrals * 5) + 50;  -- Recalculate to ensure exact points
      ELSE
        random_referrals := LEAST(floor(random_points / 5.0)::INTEGER, 17);  -- Max 17 referrals without LinkedIn
        random_points := random_referrals * 5;  -- Recalculate to ensure exact points
      END IF;

      -- Calculate signup position (sequential after real users)
      base_signup_position := current_max_position + i;

      -- Calculate effective position
      -- Cannot go below the number of real users + 1
      calculated_position := GREATEST(
        current_max_position + 1,
        base_signup_position - random_points
      );

      -- Insert entry
      INSERT INTO meetings_waitlist (
        email,
        full_name,
        company_name,
        referral_code,
        signup_position,
        effective_position,
        referral_count,
        linkedin_boost_claimed,
        total_points,
        profile_image_url,
        status,
        created_at
      ) VALUES (
        random_email,
        random_first || ' ' || random_last,
        random_company,
        random_code,
        base_signup_position,
        calculated_position,
        random_referrals,
        has_linkedin,
        random_points,
        random_profile,
        'pending',
        NOW() - (random() * interval '30 days')
      )
      ON CONFLICT (email) DO NOTHING;
    END;
  END LOOP;
END $$;

-- Step 5: Re-enable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 6: Verify the seeded data
SELECT
  COUNT(*) as total_entries,
  MIN(total_points) as min_points,
  MAX(total_points) as max_points,
  ROUND(AVG(total_points)::numeric, 2) as avg_points,
  COUNT(*) FILTER (WHERE linkedin_boost_claimed) as users_with_linkedin,
  COUNT(*) FILTER (WHERE referral_count > 0) as users_with_referrals
FROM meetings_waitlist;

-- Step 7: Show points distribution
SELECT
  CASE
    WHEN total_points = 0 THEN '0 points'
    WHEN total_points BETWEEN 1 AND 15 THEN '1-15 points'
    WHEN total_points BETWEEN 16 AND 30 THEN '16-30 points'
    WHEN total_points BETWEEN 31 AND 50 THEN '31-50 points'
    WHEN total_points BETWEEN 51 AND 70 THEN '51-70 points'
    ELSE '71-87 points'
  END as point_range,
  COUNT(*) as user_count
FROM meetings_waitlist
GROUP BY point_range
ORDER BY MIN(total_points);

-- Step 8: Show top 10 by effective position
SELECT
  full_name,
  company_name,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  total_points,
  signup_position - effective_position as positions_moved
FROM meetings_waitlist
ORDER BY effective_position ASC, signup_position ASC
LIMIT 10;
