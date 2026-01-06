-- Migration: Add org_id to calendar_calendars
-- Purpose: Support organization-scoped calendar management for webhooks
-- Date: 2026-01-06
--
-- This migration adds org_id to calendar_calendars table to support
-- the Google Calendar webhook sync functionality which requires org_id
-- to properly scope calendar access.

-- =============================================================================
-- 1. Add org_id column to calendar_calendars
-- =============================================================================

DO $$
BEGIN
  -- Check if org_id column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_calendars'
    AND column_name = 'org_id'
  ) THEN
    -- Add org_id column
    ALTER TABLE calendar_calendars
    ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Create index for org-based queries
    CREATE INDEX idx_calendar_calendars_org
      ON calendar_calendars(org_id);

    -- Backfill org_id from user's current organization
    -- This uses organization_memberships to find the user's org
    UPDATE calendar_calendars cc
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = cc.user_id
      LIMIT 1
    )
    WHERE org_id IS NULL;

    -- Make org_id NOT NULL after backfilling
    ALTER TABLE calendar_calendars
    ALTER COLUMN org_id SET NOT NULL;

    RAISE NOTICE 'Added org_id column to calendar_calendars and backfilled existing records';
  ELSE
    RAISE NOTICE 'org_id column already exists in calendar_calendars';
  END IF;
END $$;

-- =============================================================================
-- 2. Update RLS policies to include org_id checks (if they exist)
-- =============================================================================

-- Drop and recreate policies to include org_id checks
-- This ensures users can only access calendars in their organization

DO $$
BEGIN
  -- Check if RLS is enabled on calendar_calendars
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'calendar_calendars'
    AND rowsecurity = true
  ) THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can create own calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can update own calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can delete own calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Service role has full access to calendars" ON calendar_calendars;

    -- Recreate policies with org_id checks
    CREATE POLICY "Users can view own calendars"
      ON calendar_calendars
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        AND org_id IN (
          SELECT org_id FROM organization_memberships
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can create own calendars"
      ON calendar_calendars
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND org_id IN (
          SELECT org_id FROM organization_memberships
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own calendars"
      ON calendar_calendars
      FOR UPDATE
      TO authenticated
      USING (
        user_id = auth.uid()
        AND org_id IN (
          SELECT org_id FROM organization_memberships
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own calendars"
      ON calendar_calendars
      FOR DELETE
      TO authenticated
      USING (
        user_id = auth.uid()
        AND org_id IN (
          SELECT org_id FROM organization_memberships
          WHERE user_id = auth.uid()
        )
      );

    -- Service role can do anything (for webhooks and sync operations)
    CREATE POLICY "Service role has full access to calendars"
      ON calendar_calendars
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    RAISE NOTICE 'Updated RLS policies on calendar_calendars to include org_id checks';
  END IF;
END $$;

COMMENT ON COLUMN calendar_calendars.org_id IS
  'Organization that owns this calendar connection - required for webhook sync';
