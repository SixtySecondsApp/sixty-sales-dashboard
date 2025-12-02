-- Migration: Add seeded/fake user flag to meetings_waitlist
-- Purpose: Allow filtering of seed data users in admin view while keeping them for social proof
-- Date: 2025-12-02

-- Add is_seeded column to meetings_waitlist table
ALTER TABLE public.meetings_waitlist
ADD COLUMN is_seeded BOOLEAN NOT NULL DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX idx_meetings_waitlist_is_seeded ON public.meetings_waitlist(is_seeded);

-- Add comment explaining the field
COMMENT ON COLUMN public.meetings_waitlist.is_seeded IS
'Flag to identify seeded/fake users for social proof. These users are visible on public waitlist but can be filtered out in admin view';
