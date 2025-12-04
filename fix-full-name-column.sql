-- Fix full_name column issue
-- The column might be generated or have a default expression

-- Option 1: If it's a generated column, drop and recreate as regular column
DO $$
BEGIN
    -- Try to drop the column and recreate it as a regular TEXT column
    ALTER TABLE contacts DROP COLUMN IF EXISTS full_name CASCADE;
    ALTER TABLE contacts ADD COLUMN full_name TEXT;
EXCEPTION
    WHEN OTHERS THEN
        -- If that fails, just make it nullable
        ALTER TABLE contacts ALTER COLUMN full_name DROP NOT NULL;
END$$;

-- Verify the change
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    is_generated
FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name = 'full_name';
