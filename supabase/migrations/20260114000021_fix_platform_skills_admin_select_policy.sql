-- Fix: Allow platform admins to read ALL platform skills (including inactive)
--
-- Problem: The existing SELECT policy only allows reading active skills.
-- Admins need to read inactive skills to update/manage them.
-- Without SELECT access, UPDATE operations fail with 403.

-- Add admin SELECT policy (works alongside existing policy via OR logic)
CREATE POLICY "Platform admins can read all platform skills"
ON "public"."platform_skills"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);
