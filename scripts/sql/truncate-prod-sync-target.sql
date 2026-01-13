-- Truncate data in the target (staging) database before restoring a prod dump.
-- This is intentionally data-only: it does NOT modify schema.
--
-- Schemas: public + auth (storage excluded - Supabase internal tables not accessible)
-- Exclusions: auth.schema_migrations (system table)
--
-- Run with:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/sql/truncate-prod-sync-target.sql

DO $$
DECLARE
  -- NOTE: Storage schema excluded - Supabase internal tables have permission denied
  target_schemas text[] := ARRAY['public', 'auth'];
  r record;
BEGIN
  -- Best-effort: disable triggers/constraints in this session to avoid FK ordering issues.
  BEGIN
    EXECUTE 'SET session_replication_role = ''replica''';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not set session_replication_role to replica: %', SQLERRM;
  END;

  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = ANY(target_schemas)
      AND NOT (
        -- Auth system tables
        (schemaname = 'auth' AND tablename = 'schema_migrations')
      )
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I CASCADE;', r.schemaname, r.tablename);
  END LOOP;

  -- Truncate only storage.objects (user data), skip system tables
  BEGIN
    EXECUTE 'TRUNCATE TABLE storage.objects CASCADE';
    RAISE NOTICE 'Truncated storage.objects';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not truncate storage.objects: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'SET session_replication_role = ''origin''';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not set session_replication_role to origin: %', SQLERRM;
  END;
END $$;

