-- Add FK from user_engagement_metrics.user_id to profiles.id for PostgREST join
-- This enables the embedded resource syntax: profiles:user_id (email, first_name, last_name)

ALTER TABLE user_engagement_metrics
ADD CONSTRAINT user_engagement_metrics_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
