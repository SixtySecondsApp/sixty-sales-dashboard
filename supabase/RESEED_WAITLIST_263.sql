-- =====================================================
-- RUN THIS TO CLEAR AND RESEED WAITLIST DATA
-- =====================================================
-- This will delete the fake seeded entries and recreate them
-- with proper position calculations

-- Step 1: Delete all fake entries (keep real users)
DELETE FROM meetings_waitlist
WHERE email LIKE '%@%.com'
  AND email NOT LIKE '%@sixtyseconds.video';

-- Step 2: Reset sequence for real users (1-4 positions)
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
  effective_position = GREATEST(1, ranked_real_users.new_position - (referral_count * 5))
FROM ranked_real_users
WHERE meetings_waitlist.id = ranked_real_users.id;

-- Step 3: Insert 263 fake entries with realistic referral distribution
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

      -- Generate random referral count (0-17, weighted distribution)
      random_referrals := CASE
        WHEN random() < 0.6 THEN floor(random() * 3)::INTEGER  -- 60% chance: 0-2 referrals
        WHEN random() < 0.85 THEN floor(random() * 7)::INTEGER -- 25% chance: 3-6 referrals
        ELSE floor(random() * 18)::INTEGER                      -- 15% chance: 7-17 referrals
      END;

      -- Calculate signup position (sequential after real users)
      base_signup_position := current_max_position + i;

      -- Calculate effective position
      -- Cannot go below 1 OR below the number of real users ahead of them
      calculated_position := GREATEST(
        current_max_position + 1,  -- Can't jump ahead of all real users
        base_signup_position - (random_referrals * 5)
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
        random_profile,
        'pending',
        NOW() - (random() * interval '30 days')
      )
      ON CONFLICT (email) DO NOTHING;
    END;
  END LOOP;
END $$;

-- Step 4: Verify the seeded data
SELECT
  COUNT(*) as total_entries,
  COUNT(DISTINCT profile_image_url) as unique_profiles,
  MIN(referral_count) as min_referrals,
  MAX(referral_count) as max_referrals,
  ROUND(AVG(referral_count)::numeric, 2) as avg_referrals,
  MIN(effective_position) as min_position,
  MAX(effective_position) as max_position
FROM meetings_waitlist;

-- Step 5: Show referral count distribution
SELECT
  referral_count,
  COUNT(*) as user_count,
  referral_count * 5 as points_earned
FROM meetings_waitlist
WHERE referral_count > 0
GROUP BY referral_count
ORDER BY referral_count DESC;

-- Step 6: Show top 10 by effective position
SELECT
  full_name,
  company_name,
  signup_position,
  effective_position,
  referral_count,
  referral_count * 5 as points_earned,
  signup_position - effective_position as positions_moved
FROM meetings_waitlist
ORDER BY effective_position ASC, signup_position ASC
LIMIT 10;
