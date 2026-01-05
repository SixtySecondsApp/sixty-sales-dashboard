-- Migration: Add CRM Sync Columns to Recordings
-- Purpose: Add columns for tracking CRM synchronization status
-- Date: 2026-01-04

-- Add crm_synced flag to track sync status
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS crm_synced BOOLEAN DEFAULT false;

-- Add HubSpot engagement ID for external reference
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS hubspot_engagement_id TEXT;

-- Add index for CRM sync status
CREATE INDEX IF NOT EXISTS idx_recordings_crm_synced ON recordings(crm_synced) WHERE crm_synced = false;
