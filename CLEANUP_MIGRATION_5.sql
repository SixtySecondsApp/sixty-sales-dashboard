-- ONLY run this if migration #5 is incomplete and you need to re-apply it
-- This will clean up partial migration #5 and allow re-running

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_contact_insights_contact;
DROP INDEX IF EXISTS idx_contact_insights_last_meeting;
DROP INDEX IF EXISTS idx_company_insights_company;
DROP INDEX IF EXISTS idx_company_insights_last_meeting;

-- Drop tables if they exist
DROP TABLE IF EXISTS contact_meeting_insights CASCADE;
DROP TABLE IF EXISTS company_meeting_insights CASCADE;

-- Now you can re-run migration #5 from scratch
