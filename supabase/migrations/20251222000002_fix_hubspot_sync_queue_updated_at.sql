-- Fix: Add missing updated_at column to hubspot_sync_queue
-- Required by the trg_enqueue_hubspot_meeting_note trigger

ALTER TABLE public.hubspot_sync_queue
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add clerk_org_id column if missing (referenced in triggers)
ALTER TABLE public.hubspot_sync_queue
  ADD COLUMN IF NOT EXISTS clerk_org_id text;
