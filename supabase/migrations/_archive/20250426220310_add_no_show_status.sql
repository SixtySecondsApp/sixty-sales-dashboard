-- Add no_show status to activities table
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities') THEN
    -- Drop the existing constraint if it exists
    ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_status_check;

    -- Add the new constraint including 'no_show'
    ALTER TABLE public.activities
    ADD CONSTRAINT activities_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));

    -- Optional: Add a comment to the constraint for clarity
    COMMENT ON CONSTRAINT activities_status_check ON public.activities
    IS 'Ensures activities status is one of: pending, completed, cancelled, no_show';
  ELSE
    RAISE NOTICE 'Skipping migration - activities table does not exist';
  END IF;
END $$;
