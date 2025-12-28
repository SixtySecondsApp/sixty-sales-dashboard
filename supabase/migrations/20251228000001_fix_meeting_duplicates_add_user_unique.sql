-- ============================================================================
-- Migration: Add user-scoped unique constraint for meetings
-- ============================================================================
-- Problem:
--   Meetings can have duplicates when org_id is NULL because the unique
--   constraint (org_id, fathom_recording_id) only applies when org_id IS NOT NULL.
--
-- Fix:
--   1. Fix broken trigger function (missing schema qualification with search_path='')
--   2. Fix audit_trigger_function to use fully qualified function calls
--   3. Delete duplicate rows (keep most recent by meeting_start)
--   4. Add unique constraint on (owner_user_id, fathom_recording_id) for user-scoped meetings
-- ============================================================================

-- Set search_path for this migration session
SET search_path TO public, auth;

-- Step 1: Fix the trigger function that has search_path='' but unqualified table names
-- This was causing "relation contacts does not exist" errors on meeting deletes
CREATE OR REPLACE FUNCTION public.update_contact_meeting_stats_on_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
BEGIN
  -- Update total_meetings_count for the contact
  UPDATE public.contacts
  SET
    total_meetings_count = (
      SELECT COUNT(*)
      FROM public.meeting_contacts
      WHERE contact_id = OLD.contact_id
    ),
    last_interaction_at = (
      SELECT MAX(m.meeting_start)
      FROM public.meetings m
      JOIN public.meeting_contacts mc ON m.id = mc.meeting_id
      WHERE mc.contact_id = OLD.contact_id
    )
  WHERE id = OLD.contact_id;

  RETURN OLD;
END;
$function$;

-- Step 2: Fix audit_trigger_function to use fully qualified function calls
-- This function is on activities, deals, contacts, companies, tasks and calls get_changed_fields()
-- Without fully qualified name, it fails when search_path is empty
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    new_data := NULL;

    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      user_id,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      TG_OP,
      auth.uid(),
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );

    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    changed_fields := public.get_changed_fields(old_data, new_data);

    -- Only log if there were actual changes
    IF array_length(changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        user_id,
        old_data,
        new_data,
        changed_fields
      ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        auth.uid(),
        old_data,
        new_data,
        changed_fields
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    old_data := NULL;
    new_data := to_jsonb(NEW);

    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      user_id,
      old_data,
      new_data,
      changed_fields
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      TG_OP,
      auth.uid(),
      old_data,
      new_data,
      ARRAY[TG_TABLE_NAME || ' record']
    );

    RETURN NEW;
  END IF;
END;
$function$;

-- Step 3: Delete duplicate meetings (keep most recent by meeting_start, then created_at)
-- Using CTE to safely identify and delete duplicates
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY fathom_recording_id, owner_user_id
             ORDER BY meeting_start DESC NULLS LAST, created_at DESC NULLS LAST
           ) as rn
    FROM meetings
    WHERE fathom_recording_id IS NOT NULL
      AND owner_user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
)
DELETE FROM meetings
WHERE id IN (SELECT id FROM duplicates);

-- Step 4: Add unique constraint for user-scoped meetings
-- This prevents future duplicates when syncing meetings for the same user
CREATE UNIQUE INDEX IF NOT EXISTS uq_meetings_user_fathom_recording
  ON public.meetings(owner_user_id, fathom_recording_id)
  WHERE owner_user_id IS NOT NULL AND fathom_recording_id IS NOT NULL;

COMMENT ON INDEX public.uq_meetings_user_fathom_recording IS
  'Ensures unique Fathom recordings per user. Complements org-scoped uniqueness.';
