-- Verification queries for Relationship Health Monitor migrations
-- Run these in Supabase SQL Editor to verify migrations

-- 1. Check all tables exist
SELECT tablename FROM pg_tables
WHERE tablename IN (
  'relationship_health_scores',
  'ghost_detection_signals',
  'intervention_templates',
  'interventions',
  'communication_events',
  'relationship_health_history'
)
ORDER BY tablename;

-- 2. Check seed data (should return 9 templates)
SELECT COUNT(*) as template_count, 
       COUNT(DISTINCT template_type) as type_count,
       COUNT(DISTINCT context_trigger) as context_count
FROM intervention_templates;

-- 3. Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'relationship_health_scores',
  'ghost_detection_signals',
  'intervention_templates',
  'interventions',
  'communication_events',
  'relationship_health_history'
);

-- 4. List all intervention templates
SELECT template_name, template_type, context_trigger, is_system_template
FROM intervention_templates
ORDER BY template_type, template_name;
