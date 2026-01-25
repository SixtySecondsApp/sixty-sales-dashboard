-- Add user_id column to integration_alerts for per-user notifications
-- This enables the token refresh function to create alerts tied to specific users
-- rather than just organization-wide alerts

-- Add the column
ALTER TABLE "public"."integration_alerts"
ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Create index for efficient user-specific queries
CREATE INDEX IF NOT EXISTS "idx_integration_alerts_user_id"
ON "public"."integration_alerts"("user_id");

-- Add RLS policy for users to read their own alerts
CREATE POLICY "Users can read their own integration alerts"
ON "public"."integration_alerts"
FOR SELECT
TO "authenticated"
USING (
  "user_id" = "auth"."uid"()
  OR EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE "profiles"."id" = "auth"."uid"()
    AND "profiles"."is_admin" = true
  )
);

-- Comment for documentation
COMMENT ON COLUMN "public"."integration_alerts"."user_id" IS 'User who owns the integration that generated this alert. NULL for org-wide alerts.';
