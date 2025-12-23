#!/bin/bash
# Relationship Health Monitor - Migration Runner
# This script helps you run migrations in the correct order

echo "=========================================="
echo "Relationship Health Monitor Migrations"
echo "=========================================="
echo ""

MIGRATIONS=(
  "20251122000001_create_relationship_health_scores.sql"
  "20251122000002_create_ghost_detection_signals.sql"
  "20251122000003_create_intervention_templates.sql"
  "20251122000004_create_interventions.sql"
  "20251122000005_create_communication_events.sql"
  "20251122000006_create_relationship_health_history.sql"
  "20251122000007_seed_intervention_templates.sql"
)

echo "Migration files to run (in order):"
echo "-----------------------------------"
for i in "${!MIGRATIONS[@]}"; do
  echo "$((i+1)). ${MIGRATIONS[$i]}"
done
echo ""
echo "To run via Supabase CLI:"
echo "------------------------"
for migration in "${MIGRATIONS[@]}"; do
  echo "supabase db execute --file supabase/migrations/$migration"
done
echo ""
echo "Or use: supabase db push (to run all pending migrations)"
echo ""
echo "To verify migrations:"
echo "---------------------"
echo "Run this SQL in Supabase SQL Editor:"
echo ""
cat << 'SQL'
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
SQL
echo ""
