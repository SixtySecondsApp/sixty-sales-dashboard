-- RESET DEV DATABASE SCRIPT
-- Run this in the Supabase Dashboard SQL Editor for project: jczngsvpywgrlgdwzjbr
-- This will drop all tables and allow fresh migration application

-- WARNING: This will delete ALL data in the development database!
-- Only run this on the DEVELOPMENT project, never on production!

-- Step 1: Drop all tables in public schema (cascade to handle dependencies)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Disable triggers
    SET session_replication_role = 'replica';

    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Re-enable triggers
    SET session_replication_role = 'origin';
END $$;

-- Step 2: Drop all functions in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT ns.nspname as schema_name, p.proname as function_name,
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public'
    )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.function_name) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- Step 3: Drop all types in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    )
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Step 4: Clear the migrations table so Supabase CLI can re-apply all migrations
TRUNCATE TABLE supabase_migrations.schema_migrations;

-- Done! Now run: supabase db push --linked
SELECT 'Database reset complete. Run "supabase db push --linked" to apply all migrations.' as status;
