-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- Seeds 263 fake waitlist entries for initial leaderboard data
-- Combined with real signups, total will show as live count
--
-- Features:
-- - Random referral counts (0-17, weighted distribution)
-- - Points range: 0-85 (referral_count * 5)
-- - Most users have 0-2 referrals (50%)
-- - Some users have 3-6 referrals (30%)
-- - Few users have 7-17 referrals (20%)
--
-- Note: We provide all required values (referral_code, positions, etc.)
-- directly in the INSERT, so triggers won't be invoked and no permission
-- errors will occur with system triggers.

-- Step 1: Add profile_image_url column if it doesn't exist
ALTER TABLE meetings_waitlist ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Step 2: Insert 263 fake waitlist entries with all values pre-calculated
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
BEGIN
  FOR i IN 1..263 LOOP
    DECLARE
      random_referrals INTEGER;
      calculated_position INTEGER;
    BEGIN
      -- Generate random data
      random_first := first_names[1 + floor(random() * array_length(first_names, 1))];
      random_last := last_names[1 + floor(random() * array_length(last_names, 1))];
      random_company := companies[1 + floor(random() * array_length(companies, 1))];
      random_profile := profile_images[1 + floor(random() * array_length(profile_images, 1))];
      random_email := lower(random_first || '.' || random_last || floor(random() * 1000)::text || '@' || replace(lower(random_company), ' ', '') || '.com');
      random_code := 'MEET-' || upper(substring(md5(random()::text) from 1 for 6));

      -- Generate random referral count (0-17, which equals 0-85 points)
      -- Higher referral counts are less common (weighted distribution)
      random_referrals := CASE
        WHEN random() < 0.5 THEN floor(random() * 3)::INTEGER  -- 50% chance: 0-2 referrals
        WHEN random() < 0.8 THEN floor(random() * 7)::INTEGER  -- 30% chance: 0-6 referrals
        ELSE floor(random() * 18)::INTEGER                      -- 20% chance: 0-17 referrals
      END;

      -- Calculate effective position: signup_position - (referrals * 5), minimum 1
      calculated_position := GREATEST(1, (i + 5) - (random_referrals * 5));

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
        i + 5, -- Start after the 5 existing entries
        calculated_position,
        random_referrals,
        random_profile,
        'pending',
        NOW() - (random() * interval '30 days') -- Random signup time in last 30 days
      )
      ON CONFLICT (email) DO NOTHING; -- Skip if email already exists
    END;
  END LOOP;
END $$;

-- Step 3: Verify the seeded data
SELECT
  COUNT(*) as total_entries,
  COUNT(DISTINCT profile_image_url) as unique_profiles,
  MIN(referral_count) as min_referrals,
  MAX(referral_count) as max_referrals,
  ROUND(AVG(referral_count)::numeric, 2) as avg_referrals
FROM meetings_waitlist;

-- Step 3.5: Show referral count distribution
SELECT
  referral_count,
  COUNT(*) as user_count,
  referral_count * 5 as points_earned
FROM meetings_waitlist
WHERE referral_count > 0
GROUP BY referral_count
ORDER BY referral_count DESC;

-- Step 4: Show first 10 entries with profile images and referrals
SELECT
  id,
  full_name,
  company_name,
  email,
  profile_image_url,
  signup_position,
  effective_position,
  referral_count,
  referral_count * 5 as points_earned,
  created_at
FROM meetings_waitlist
ORDER BY effective_position ASC
LIMIT 10;
