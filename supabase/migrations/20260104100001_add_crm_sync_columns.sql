-- Migration: Add CRM Sync Columns to Recordings
-- Purpose: Add columns for tracking CRM synchronization status
-- Date: 2026-01-04

-- Add crm_synced flag to track sync status
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS crm_synced BOOLEAN DEFAULT false;

-- Add HubSpot engagement ID for external reference
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS hubspot_engagement_id TEXT;

-- Add index for CRM sync status
CREATE INDEX IF NOT EXISTS idx_recordings_crm_synced ON recordings(crm_synced) WHERE crm_synced = false;

-- =============================================================================
-- hitl_requests table for Human-in-the-Loop workflows
-- =============================================================================
CREATE TABLE IF NOT EXISTS hitl_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request type and status
  request_type TEXT NOT NULL CHECK (request_type IN ('speaker_confirmation', 'deal_selection', 'contact_selection')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'skipped')),

  -- Options and selection
  options JSONB NOT NULL, -- Available options for selection
  selected_option JSONB, -- User's selection

  -- Timestamps
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for hitl_requests
CREATE INDEX IF NOT EXISTS idx_hitl_requests_org ON hitl_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_recording ON hitl_requests(recording_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_user ON hitl_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_status ON hitl_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hitl_requests_type_status ON hitl_requests(request_type, status);

-- RLS Policies for hitl_requests
ALTER TABLE hitl_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hitl_requests'
    AND policyname = 'Users can view their own HITL requests'
  ) THEN
    CREATE POLICY "Users can view their own HITL requests"
      ON hitl_requests FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hitl_requests'
    AND policyname = 'Users can update their own HITL requests'
  ) THEN
    CREATE POLICY "Users can update their own HITL requests"
      ON hitl_requests FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      ))
      WITH CHECK (user_id = auth.uid() OR org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Updated_at trigger for hitl_requests
CREATE OR REPLACE TRIGGER update_hitl_requests_updated_at
  BEFORE UPDATE ON hitl_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
