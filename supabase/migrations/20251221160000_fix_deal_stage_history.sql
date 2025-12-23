-- ============================================================================
-- Migration: Fix deal_stage_history table
-- ============================================================================
-- Issue: Table might not exist or might be missing columns expected by app code
-- The app's DealRepository expects: previous_stage_id, new_stage_id, changed_at, changed_by
-- ============================================================================

-- Create table if it doesn't exist with the schema the app expects
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  stage_id UUID,
  user_id UUID,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  -- Additional columns that DealRepository expects
  previous_stage_id UUID,
  new_stage_id UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add previous_stage_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'deal_stage_history'
    AND column_name = 'previous_stage_id') THEN
    ALTER TABLE public.deal_stage_history ADD COLUMN previous_stage_id UUID;
  END IF;

  -- Add new_stage_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'deal_stage_history'
    AND column_name = 'new_stage_id') THEN
    ALTER TABLE public.deal_stage_history ADD COLUMN new_stage_id UUID;
  END IF;

  -- Add changed_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'deal_stage_history'
    AND column_name = 'changed_at') THEN
    ALTER TABLE public.deal_stage_history ADD COLUMN changed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add changed_by if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'deal_stage_history'
    AND column_name = 'changed_by') THEN
    ALTER TABLE public.deal_stage_history ADD COLUMN changed_by UUID;
  END IF;
END $$;

-- Add foreign key constraints (safe - uses IF NOT EXISTS pattern)
DO $$
BEGIN
  -- FK to deals
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deal_stage_history_deal_id_fkey') THEN
    ALTER TABLE public.deal_stage_history
      ADD CONSTRAINT deal_stage_history_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if constraint already exists or fails
  NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON public.deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_at ON public.deal_stage_history(changed_at);

-- Enable RLS
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "deal_stage_history_select" ON public.deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_insert" ON public.deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_update" ON public.deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_delete" ON public.deal_stage_history;
DROP POLICY IF EXISTS "Users can view their deal stage history" ON public.deal_stage_history;
DROP POLICY IF EXISTS "Users can view deal stage history" ON public.deal_stage_history;
DROP POLICY IF EXISTS "service_role_deal_stage_history" ON public.deal_stage_history;

-- Create RLS policies (simplified - check deal ownership or org membership via profiles)
CREATE POLICY "deal_stage_history_select" ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid() OR owner_id = auth.uid())
  );

CREATE POLICY "deal_stage_history_insert" ON public.deal_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid() OR owner_id = auth.uid())
  );

-- Service role access
CREATE POLICY "service_role_deal_stage_history" ON public.deal_stage_history
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT ON public.deal_stage_history TO authenticated;
GRANT ALL ON public.deal_stage_history TO service_role;

COMMENT ON TABLE public.deal_stage_history IS 'Tracks deal stage transitions for pipeline analytics';
