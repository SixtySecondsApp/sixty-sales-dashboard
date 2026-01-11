#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

redact_url() {
  echo "$1" | sed -E 's#//[^@/]*@#//***:***@#'
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "❌ Missing required env var: ${name}"
    exit 1
  fi
}

echo "🔄 Production → Staging (data-only) sync"
echo "======================================="
echo ""

require_cmd supabase
require_cmd psql
require_cmd docker

# Check Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

require_env PROD_DB_URL
require_env STAGING_DB_URL

if [[ "${PROD_DB_URL}" == "${STAGING_DB_URL}" ]]; then
  echo "❌ PROD_DB_URL and STAGING_DB_URL are identical. Refusing to continue."
  exit 1
fi

# Default to public and auth schemas (storage has Supabase internal tables we can't access)
SYNC_SCHEMAS="${SYNC_SCHEMAS:-public,auth}"
DUMP_FILE="${DUMP_FILE:-${REPO_ROOT}/tmp/prod-to-staging.sql}"
EXCLUDE_TABLE_DATA="${EXCLUDE_TABLE_DATA:-auth.sessions,auth.refresh_tokens,auth.audit_log_entries}"

echo "Source (production): $(redact_url "${PROD_DB_URL}")"
echo "Target (staging):    $(redact_url "${STAGING_DB_URL}")"
echo ""
echo "Schemas:             ${SYNC_SCHEMAS}"
echo "Dump file:           ${DUMP_FILE}"
echo "Exclude table data:  ${EXCLUDE_TABLE_DATA}"
echo ""

if [[ "${SYNC_PROD_TO_STAGING:-}" != "yes" ]]; then
  echo "⚠️  This will TRUNCATE and overwrite staging data."
  echo ""
  echo "To continue, run with:"
  echo "  SYNC_PROD_TO_STAGING=yes npm run sync:staging:full"
  exit 1
fi

mkdir -p "$(dirname "${DUMP_FILE}")"

# Build schema flags for supabase db dump
IFS=',' read -r -a schema_list <<< "${SYNC_SCHEMAS}"
schema_flags=()
for s in "${schema_list[@]}"; do
  s="$(echo "$s" | xargs)"
  [[ -z "$s" ]] && continue
  schema_flags+=( "-s" "${s}" )
done

# Build exclude flags
IFS=',' read -r -a exclude_list <<< "${EXCLUDE_TABLE_DATA}"
exclude_flags=()
for t in "${exclude_list[@]}"; do
  t="$(echo "$t" | xargs)"
  [[ -z "$t" ]] && continue
  exclude_flags+=( "-x" "${t}" )
done

echo "📦 Step 1/3: Dumping production data (using Supabase CLI)..."
# Supabase CLI dump includes session_replication_role=replica which bypasses FK constraints
supabase db dump \
  --db-url "${PROD_DB_URL}" \
  --data-only \
  "${schema_flags[@]}" \
  "${exclude_flags[@]}" \
  -f "${DUMP_FILE}"

if [[ ! -s "${DUMP_FILE}" ]]; then
  echo "❌ Dump failed or produced an empty file: ${DUMP_FILE}"
  exit 1
fi

echo "✅ Dump created: $(du -h "${DUMP_FILE}" | awk '{print $1}')"
echo ""

echo "🗑️  Step 2/3: Truncating staging tables..."
psql "${STAGING_DB_URL}" \
  -v ON_ERROR_STOP=1 \
  -f "${REPO_ROOT}/scripts/sql/truncate-prod-sync-target.sql"
echo "✅ Staging tables truncated"
echo ""

echo "📥 Step 3/3: Restoring data into staging..."
# The dump file already contains SET session_replication_role = 'replica'
# which disables FK constraints during restore
psql "${STAGING_DB_URL}" \
  -v ON_ERROR_STOP=0 \
  -f "${DUMP_FILE}"
echo "✅ Restore complete"
echo ""

echo "🔍 Validation (row counts)..."
echo ""
echo "Production counts:"
psql "${PROD_DB_URL}" -t -A -F $'\t' -c "
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL SELECT 'organizations', COUNT(*) FROM public.organizations
UNION ALL SELECT 'deals', COUNT(*) FROM public.deals
UNION ALL SELECT 'meetings', COUNT(*) FROM public.meetings
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
ORDER BY 1;"
echo ""
echo "Staging counts:"
psql "${STAGING_DB_URL}" -t -A -F $'\t' -c "
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL SELECT 'organizations', COUNT(*) FROM public.organizations
UNION ALL SELECT 'deals', COUNT(*) FROM public.deals
UNION ALL SELECT 'meetings', COUNT(*) FROM public.meetings
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
ORDER BY 1;"
echo ""

# Cleanup
rm -f "${DUMP_FILE}"
echo "🧹 Cleaned up dump file"
echo ""
echo "✅ Production → staging data sync finished."
