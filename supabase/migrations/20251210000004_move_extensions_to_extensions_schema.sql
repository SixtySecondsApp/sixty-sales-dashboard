-- Migration: Move extensions from public schema to extensions schema
-- Addresses extension_in_public security warnings
-- Applied: 2025-12-10
--
-- This resolves WARN-level security linter issues:
-- - citext extension in public schema
-- - pg_trgm extension in public schema
--
-- Extensions should not be in public schema for security best practices
-- The 'extensions' schema is the standard location in Supabase

-- Move citext extension to extensions schema
ALTER EXTENSION citext SET SCHEMA extensions;

-- Move pg_trgm extension to extensions schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Note: This may affect any code that explicitly references public.citext
-- or public.pg_trgm functions. However, since these are commonly used
-- via implicit type casting, most code should continue to work.
--
-- If there are issues, you may need to add 'extensions' to search_path
-- or explicitly reference extensions.function_name()
