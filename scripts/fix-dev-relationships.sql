-- FIX DEV DATABASE RELATIONSHIPS
-- Run this in Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr/sql/new
-- This adds missing foreign keys and tables for PostgREST joins

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
-- 3. MEETINGS -> COMPANIES FOREIGN KEY (for fk_meetings_company_id join)
-- ============================================================================
-- First add company_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN company_id UUID;
  END IF;
END $$;

-- Add foreign key if missing
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
-- 4. MEETING_ACTION_ITEMS TABLE (if not properly linked)
-- ============================================================================
-- Add meeting_id foreign key to meeting_action_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_action_items_meeting_id'
    AND table_name = 'meeting_action_items'
  ) THEN
    -- First check if the column exists
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
-- 5. TASKS -> MEETINGS FOREIGN KEY (for tasks join in meetings query)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'meeting_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN meeting_id UUID;
  END IF;
END $$;

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
-- PostgREST auto-reloads on schema changes, but this ensures it
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 7. VERIFY SETUP
-- ============================================================================
SELECT 'Foreign keys and tables created successfully!' as status;

-- Show all foreign keys on key tables
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('activities', 'meetings', 'tasks', 'meeting_action_items')
ORDER BY tc.table_name;
