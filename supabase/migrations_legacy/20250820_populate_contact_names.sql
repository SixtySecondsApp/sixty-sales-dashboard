-- Populate first_name and last_name from full_name for existing contacts
-- This migration splits the full_name field to populate missing first_name and last_name fields

-- Update contacts where first_name and last_name are NULL but full_name exists
UPDATE contacts
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      SPLIT_PART(full_name, ' ', 1)
    ELSE first_name
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 THEN
      SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE last_name
  END
WHERE 
  (first_name IS NULL OR first_name = '') 
  AND (last_name IS NULL OR last_name = '')
  AND full_name IS NOT NULL 
  AND full_name != '';

-- Also ensure full_name is populated for records that have first_name and/or last_name but no full_name
UPDATE contacts
SET 
  full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE 
  (full_name IS NULL OR full_name = '')
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Create a trigger to automatically populate full_name from first_name and last_name
CREATE OR REPLACE FUNCTION update_contact_full_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If full_name is not provided but first_name or last_name are provided
  IF (NEW.full_name IS NULL OR NEW.full_name = '') AND 
     (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  END IF;
  
  -- If full_name is provided but first_name and last_name are not
  IF (NEW.first_name IS NULL OR NEW.first_name = '') AND 
     (NEW.last_name IS NULL OR NEW.last_name = '') AND
     NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    NEW.first_name := SPLIT_PART(NEW.full_name, ' ', 1);
    IF ARRAY_LENGTH(STRING_TO_ARRAY(NEW.full_name, ' '), 1) > 1 THEN
      NEW.last_name := SUBSTRING(NEW.full_name FROM POSITION(' ' IN NEW.full_name) + 1);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_contact_names ON contacts;

-- Create the trigger for both INSERT and UPDATE
CREATE TRIGGER ensure_contact_names
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_full_name();