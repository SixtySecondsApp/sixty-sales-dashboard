-- FIX DEV DATABASE RELATIONSHIPS - V2
-- Run this in Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr/sql/new

-- ============================================================================
-- 1. FATHOM INTEGRATIONS TABLE (404 error)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fathom_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  fathom_user_id TEXT,
  fathom_user_email TEXT,
  scopes TEXT[] DEFAULT ARRAY['calls:read', 'analytics:read', 'highlights:write'],
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(fathom_user_id)
);

ALTER TABLE public.fathom_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own Fathom integration" ON public.fathom_integrations;
CREATE POLICY "Users can view their own Fathom integration" ON public.fathom_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own Fathom integration" ON public.fathom_integrations;
CREATE POLICY "Users can manage their own Fathom integration" ON public.fathom_integrations
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.fathom_integrations TO authenticated;

-- ============================================================================
-- 2. ACTIVITIES -> DEALS FOREIGN KEY (400 error on join)
-- ============================================================================
-- First clear orphan deal_id references
UPDATE public.activities
SET deal_id = NULL
WHERE deal_id IS NOT NULL
AND deal_id NOT IN (SELECT id FROM public.deals);

-- Now add the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_activities_deal_id'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE public.activities
    ADD CONSTRAINT fk_activities_deal_id
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. MEETINGS -> COMPANIES FOREIGN KEY
-- ============================================================================
-- First clear orphan company_id references in meetings
UPDATE public.meetings
SET company_id = NULL
WHERE company_id IS NOT NULL
AND company_id NOT IN (SELECT id FROM public.companies);

-- Now add the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meetings_company_id'
    AND table_name = 'meetings'
  ) THEN
    ALTER TABLE public.meetings
    ADD CONSTRAINT fk_meetings_company_id
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. MEETING_ACTION_ITEMS -> MEETINGS FOREIGN KEY
-- ============================================================================
-- Clear orphan meeting_id references
UPDATE public.meeting_action_items
SET meeting_id = NULL
WHERE meeting_id IS NOT NULL
AND meeting_id NOT IN (SELECT id FROM public.meetings);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_action_items_meeting_id'
    AND table_name = 'meeting_action_items'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meeting_action_items' AND column_name = 'meeting_id'
    ) THEN
      ALTER TABLE public.meeting_action_items
      ADD CONSTRAINT fk_meeting_action_items_meeting_id
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. TASKS -> MEETINGS FOREIGN KEY
-- ============================================================================
-- Add meeting_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'meeting_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN meeting_id UUID;
  END IF;
END $$;

-- Clear orphan meeting_id references in tasks
UPDATE public.tasks
SET meeting_id = NULL
WHERE meeting_id IS NOT NULL
AND meeting_id NOT IN (SELECT id FROM public.meetings);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_meeting_id'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT fk_tasks_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 7. VERIFY SETUP
-- ============================================================================
SELECT 'All fixes applied successfully!' as status;
