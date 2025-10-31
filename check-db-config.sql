-- Check Database Configuration for Next-Actions
-- Run this in Supabase SQL Editor

SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN 'SET'
    ELSE 'NOT SET'
  END as service_role_key_status;
