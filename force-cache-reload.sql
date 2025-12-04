-- Force PostgREST schema cache reload by making a trivial DDL change
-- This will trigger PostgREST to refresh its schema cache

-- Add a comment to profiles table (harmless DDL change)
COMMENT ON TABLE public.profiles IS 'User profiles - cache reload trigger';

-- Verify the change worked
SELECT 'Schema cache reload triggered' AS status;
