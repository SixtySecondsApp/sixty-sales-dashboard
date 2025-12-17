-- Seed 600 fake waitlist signups for testing and social proof
-- These will be marked as is_seeded = true so they can be filtered in admin view

-- Temporarily disable admin action logging trigger if it exists (it requires waitlist_admin_actions table)
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Registration URL options (matching the access links)
DO $$
DECLARE
  registration_urls TEXT[] := ARRAY['/waitlist', '/introduction', '/introducing', '/intro', '/signup'];
  first_names TEXT[] := ARRAY['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah'];
  last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];
  companies TEXT[] := ARRAY['Acme Corp', 'Tech Solutions Inc', 'Global Industries', 'Digital Ventures', 'Innovation Labs', 'Future Systems', 'Smart Business', 'Enterprise Solutions', 'Cloud Services', 'Data Analytics Co', 'Software Dynamics', 'Network Solutions', 'Creative Agency', 'Marketing Pro', 'Sales Force', 'Business Partners', 'Strategic Consulting', 'Growth Partners', 'Success Corp', 'Elite Services'];
  dialer_tools TEXT[] := ARRAY['JustCall', 'CloudTalk', 'Aircall', 'RingCentral Contact Center', 'Five9', '8x8 Contact Center', 'Dialpad', 'Talkdesk', 'Nextiva', 'Channels', 'Other', 'None'];
  meeting_recorders TEXT[] := ARRAY['Fireflies.ai', 'Fathom', 'Otter.ai', 'Read.ai', 'tl;dv', 'Notta', 'Sembly AI', 'Grain', 'Mem', 'BuildBetter.ai', 'Other', 'None'];
  crm_tools TEXT[] := ARRAY['Salesforce', 'HubSpot CRM', 'Zoho CRM', 'Pipedrive', 'Microsoft Dynamics 365', 'Freshsales', 'Monday Sales CRM', 'Insightly', 'Bullhorn', 'Capsule CRM', 'Other', 'None'];
  task_managers TEXT[] := ARRAY['Monday', 'Jira', 'Coda', 'Asana', 'Teams', 'Trello', 'Other', 'None'];
  i INTEGER;
  first_name TEXT;
  last_name TEXT;
  company TEXT;
  email TEXT;
  dialer TEXT;
  recorder TEXT;
  crm TEXT;
  task_mgr TEXT;
  reg_url TEXT;
  referral_code TEXT;
  referred_by TEXT;
  signup_pos INTEGER;
  status_val TEXT;
BEGIN
    -- Get current max position
  SELECT COALESCE(MAX(mw.signup_position), 0) INTO signup_pos FROM meetings_waitlist mw;
  
  -- Generate 600 fake signups
  FOR i IN 1..600 LOOP
    -- Random selections
    first_name := first_names[1 + floor(random() * array_length(first_names, 1))::int];
    last_name := last_names[1 + floor(random() * array_length(last_names, 1))::int];
    company := companies[1 + floor(random() * array_length(companies, 1))::int];
    email := LOWER(first_name || '.' || last_name || i || '@example' || (i % 10) || '.com');
    dialer := dialer_tools[1 + floor(random() * array_length(dialer_tools, 1))::int];
    recorder := meeting_recorders[1 + floor(random() * array_length(meeting_recorders, 1))::int];
    crm := crm_tools[1 + floor(random() * array_length(crm_tools, 1))::int];
    task_mgr := task_managers[1 + floor(random() * array_length(task_managers, 1))::int];
    reg_url := registration_urls[1 + floor(random() * array_length(registration_urls, 1))::int];
    
    -- Random status (mostly pending, some released)
    IF random() < 0.1 THEN
      status_val := 'released';
    ELSE
      status_val := 'pending';
    END IF;
    
    -- Generate referral code
    referral_code := 'MEET-' || upper(substring(md5(random()::text || i::text) from 1 for 6));
    
    -- Some entries have referrals (20% chance)
    referred_by := NULL;
    IF random() < 0.2 AND i > 10 THEN
      -- Pick a random previous entry's referral code
      SELECT mw.referral_code INTO referred_by
      FROM meetings_waitlist mw
      WHERE mw.is_seeded = true
      ORDER BY random()
      LIMIT 1;
    END IF;
    
    -- Increment position
    signup_pos := signup_pos + 1;
    
    -- Insert the fake entry
    INSERT INTO meetings_waitlist (
      email,
      full_name,
      company_name,
      dialer_tool,
      meeting_recorder_tool,
      crm_tool,
      task_manager_tool,
      referral_code,
      referred_by_code,
      signup_position,
      effective_position,
      status,
      registration_url,
      is_seeded,
      created_at,
      updated_at
    ) VALUES (
      email,
      first_name || ' ' || last_name,
      company,
      CASE WHEN dialer = 'None' THEN NULL ELSE dialer END,
      CASE WHEN recorder = 'None' THEN NULL ELSE recorder END,
      CASE WHEN crm = 'None' THEN NULL ELSE crm END,
      CASE WHEN task_mgr = 'None' THEN NULL ELSE task_mgr END,
      referral_code,
      referred_by,
      signup_pos,
      signup_pos, -- Will be recalculated by trigger
      status_val::waitlist_status,
      reg_url,
      true, -- Mark as seeded
      NOW() - (random() * INTERVAL '30 days'), -- Random creation time in last 30 days
      NOW() - (random() * INTERVAL '30 days')
    );
    
    -- Update referral count if this entry has a referrer
    IF referred_by IS NOT NULL THEN
      UPDATE meetings_waitlist mw
      SET referral_count = mw.referral_count + 1
      WHERE mw.referral_code = referred_by;
    END IF;
  END LOOP;
  
  -- Recalculate effective positions for all entries (including new seeded ones)
  UPDATE meetings_waitlist mw
  SET effective_position = GREATEST(1, mw.signup_position - (mw.referral_count * 5));
  
  RAISE NOTICE 'Successfully created 600 seeded waitlist entries';
END $$;

-- Re-enable admin action logging trigger if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist_admin_actions') THEN
    -- Recreate the trigger if the table exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_waitlist_admin_action') THEN
      CREATE TRIGGER log_admin_action_trigger
      AFTER UPDATE ON meetings_waitlist
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.released_at IS DISTINCT FROM NEW.released_at)
      EXECUTE FUNCTION log_waitlist_admin_action();
    END IF;
  END IF;
END $$;

-- Verify the seeded entries
SELECT 
  COUNT(*) as total_seeded,
  COUNT(DISTINCT mw.registration_url) as unique_registration_urls,
  mw.registration_url,
  COUNT(*) as count_per_url
FROM meetings_waitlist mw
WHERE mw.is_seeded = true
GROUP BY mw.registration_url
ORDER BY count_per_url DESC;


