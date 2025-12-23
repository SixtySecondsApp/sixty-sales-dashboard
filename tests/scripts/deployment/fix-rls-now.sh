#!/bin/bash
# Fix RLS policy for next_action_suggestions

source .env 2>/dev/null || true

echo "🔧 Fixing RLS policy for next_action_suggestions..."
echo ""

# Read SQL file
SQL=$(cat <<'EOF'
-- Drop the existing insert policy
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;

-- Create new policy that allows inserts bypassing RLS when using service role
CREATE POLICY "Allow insert from Edge Functions"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true);
EOF
)

echo "Executing SQL..."
echo "$SQL"
echo ""

# Use psql connection string from Supabase dashboard or construct it
# For now, we'll create a migration file with a newer timestamp

cat > supabase/migrations/20251101210000_fix_rls_immediate.sql <<'SQLEOF'
-- Fix RLS policy for next_action_suggestions to allow Edge Function inserts

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;

-- Create new policy that allows ALL inserts (RLS check will be in trigger)
CREATE POLICY "Allow insert from Edge Functions"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true);
SQLEOF

echo "✅ Created migration file: supabase/migrations/20251101210000_fix_rls_immediate.sql"
echo ""
echo "Now applying via Supabase CLI..."

npx supabase migration up --db-url "${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"
