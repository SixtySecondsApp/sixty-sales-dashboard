-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- This fixes the waitlist positions for existing entries

-- Step 0: Temporarily disable the admin action logging trigger
ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;

-- Step 1: Backfill signup_position based on created_at order
WITH ranked_entries AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_position
  FROM meetings_waitlist
)
UPDATE meetings_waitlist
SET signup_position = ranked_entries.new_position
FROM ranked_entries
WHERE meetings_waitlist.id = ranked_entries.id;

-- Step 2: Recalculate effective_position for all entries
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - (referral_count * 5));

-- Step 2.5: Re-enable the admin action logging trigger
ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;

-- Step 3: Verify the results
SELECT
  id,
  full_name,
  email,
  signup_position,
  referral_count,
  effective_position,
  created_at
FROM meetings_waitlist
ORDER BY effective_position ASC, created_at ASC
LIMIT 20;

-- Step 4: Check if email invite trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'award_email_points_trigger';

-- Step 5: If trigger doesn't exist, create it now
-- (You may need to run the RUN_EMAIL_INVITE_POINTS.sql script first)

-- Step 6: Verify email invites are being tracked
SELECT
  mw.full_name,
  mw.email,
  mw.referral_count,
  mw.effective_position,
  COUNT(wei.id) as email_invites_sent,
  STRING_AGG(wei.email, ', ') as invited_emails
FROM meetings_waitlist mw
LEFT JOIN waitlist_email_invites wei ON wei.waitlist_entry_id = mw.id AND wei.invite_status = 'sent'
GROUP BY mw.id, mw.full_name, mw.email, mw.referral_count, mw.effective_position
ORDER BY mw.effective_position ASC
LIMIT 10;
