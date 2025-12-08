-- FIX DEV DATA OWNERSHIP
-- Run this in Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr/sql/new
--
-- PROBLEM: Data was copied from production but owner IDs don't match dev auth users
-- SOLUTION: Reassign all orphaned data to Andrew's dev user ID
--
-- Andrew's dev user ID: bb6323fe-4e12-45f7-a607-6b9081639447

-- ============================================================================
-- 1. ACTIVITIES TABLE - user_id column
-- ============================================================================
-- The orphaned production user ID ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459 owns most activities
UPDATE public.activities
SET user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
WHERE user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- Also update any other orphaned user IDs (not in profiles table)
UPDATE public.activities
SET user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
WHERE user_id NOT IN (SELECT id FROM public.profiles);

SELECT 'Activities updated' as status, COUNT(*) as count
FROM public.activities
WHERE user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447';

-- ============================================================================
-- 2. DEALS TABLE - owner_id column
-- ============================================================================
-- Update orphaned deals to Andrew
UPDATE public.deals
SET owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
WHERE owner_id NOT IN (SELECT id FROM public.profiles);

SELECT 'Deals updated' as status, COUNT(*) as count
FROM public.deals
WHERE owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447';

-- ============================================================================
-- 3. MEETINGS TABLE - owner_user_id column
-- ============================================================================
UPDATE public.meetings
SET owner_user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
WHERE owner_user_id NOT IN (SELECT id FROM public.profiles);

SELECT 'Meetings updated' as status, COUNT(*) as count
FROM public.meetings
WHERE owner_user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447';

-- ============================================================================
-- 4. CONTACTS TABLE - owner_id column
-- ============================================================================
UPDATE public.contacts
SET owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
WHERE owner_id IS NOT NULL
AND owner_id NOT IN (SELECT id FROM public.profiles);

SELECT 'Contacts updated' as status, COUNT(*) as count
FROM public.contacts
WHERE owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447';

-- ============================================================================
-- 5. COMPANIES TABLE - owner_id column (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'owner_id'
  ) THEN
    EXECUTE 'UPDATE public.companies SET owner_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE owner_id IS NOT NULL AND owner_id NOT IN (SELECT id FROM public.profiles)';
  END IF;
END $$;

-- ============================================================================
-- 6. TASKS TABLE - assigned_to_user_id or user_id column
-- ============================================================================
-- Check what columns exist on tasks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to_user_id'
  ) THEN
    EXECUTE 'UPDATE public.tasks SET assigned_to_user_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE assigned_to_user_id IS NOT NULL AND assigned_to_user_id NOT IN (SELECT id FROM public.profiles)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'created_by_user_id'
  ) THEN
    EXECUTE 'UPDATE public.tasks SET created_by_user_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE created_by_user_id IS NOT NULL AND created_by_user_id NOT IN (SELECT id FROM public.profiles)';
  END IF;
END $$;

-- ============================================================================
-- 7. NOTIFICATIONS TABLE - user_id column
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'UPDATE public.notifications SET user_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE user_id NOT IN (SELECT id FROM public.profiles)';
  END IF;
END $$;

-- ============================================================================
-- 8. CALENDAR_EVENTS TABLE - user_id column
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
    EXECUTE 'UPDATE public.calendar_events SET user_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE user_id NOT IN (SELECT id FROM public.profiles)';
  END IF;
END $$;

-- ============================================================================
-- 9. WORKFLOW_EXECUTIONS TABLE - user_id column
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_executions') THEN
    EXECUTE 'UPDATE public.workflow_executions SET user_id = ''bb6323fe-4e12-45f7-a607-6b9081639447'' WHERE user_id NOT IN (SELECT id FROM public.profiles)';
  END IF;
END $$;

-- ============================================================================
-- 10. FINAL VERIFICATION
-- ============================================================================
SELECT 'Data ownership fix complete!' as status;

SELECT 'activities' as table_name, COUNT(*) as andrew_records
FROM public.activities WHERE user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
UNION ALL
SELECT 'deals', COUNT(*) FROM public.deals WHERE owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
UNION ALL
SELECT 'meetings', COUNT(*) FROM public.meetings WHERE owner_user_id = 'bb6323fe-4e12-45f7-a607-6b9081639447'
UNION ALL
SELECT 'contacts', COUNT(*) FROM public.contacts WHERE owner_id = 'bb6323fe-4e12-45f7-a607-6b9081639447';
