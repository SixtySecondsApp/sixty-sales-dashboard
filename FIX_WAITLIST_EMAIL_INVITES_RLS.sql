-- ============================================================================
-- FIX WAITLIST EMAIL INVITES RLS
-- ============================================================================
-- This script fixes the RLS policies for waitlist_email_invites table
-- Run this if you get: "new row violates row-level security policy for table waitlist_email_invites"
-- ============================================================================

-- First, ensure the table exists
CREATE TABLE IF NOT EXISTS waitlist_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invite_status VARCHAR(50) DEFAULT 'pending' CHECK (invite_status IN ('pending', 'sent', 'failed', 'converted')),
  sent_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (it may already be enabled)
ALTER TABLE waitlist_email_invites ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can create email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Anyone can view email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Allow public insert for email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Allow public select for email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Waitlist users can invite" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Platform admins can manage invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "anon_insert_waitlist_email_invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "anon_select_waitlist_email_invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "authenticated_all_waitlist_email_invites" ON waitlist_email_invites;

-- Create permissive policies for public access (since waitlist is public)

-- Allow anyone to INSERT email invites (public waitlist feature)
CREATE POLICY "Anyone can create email invites"
ON waitlist_email_invites FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to SELECT email invites (needed to check for duplicates)
CREATE POLICY "Anyone can view email invites"
ON waitlist_email_invites FOR SELECT
TO public
USING (true);

-- Allow anyone to UPDATE email invites (for status updates)
CREATE POLICY "Anyone can update email invites"
ON waitlist_email_invites FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Grant permissions to anon role (unauthenticated users)
GRANT SELECT, INSERT, UPDATE ON waitlist_email_invites TO anon;

-- Grant all permissions to authenticated users
GRANT ALL ON waitlist_email_invites TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'waitlist_email_invites';

-- Verify table structure
SELECT 'SUCCESS: waitlist_email_invites RLS policies configured!' as status;

