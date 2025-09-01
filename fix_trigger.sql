-- Simplified fix: Just remove the overly strict validation trigger
-- The trigger is causing issues with partial updates
DROP TRIGGER IF EXISTS validate_outbound_activity_trigger ON activities;
DROP FUNCTION IF EXISTS validate_outbound_activity();

-- Create a simpler validation that only cleans up inconsistent data
CREATE OR REPLACE FUNCTION clean_activity_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- For non-outbound activities, clear outbound_type if set
  IF NEW.type IS NOT NULL AND NEW.type != 'outbound' THEN
    NEW.outbound_type := NULL;
  END IF;
  
  -- For non-meeting activities, clear meeting-specific flags  
  IF NEW.type IS NOT NULL AND NEW.type != 'meeting' THEN
    NEW.is_rebooking := FALSE;
    NEW.is_self_generated := FALSE;
  END IF;
  
  -- For non-proposal activities, clear proposal_date
  IF NEW.type IS NOT NULL AND NEW.type != 'proposal' THEN
    NEW.proposal_date := NULL;
  END IF;
  
  -- For non-sale activities, clear sale_date
  IF NEW.type IS NOT NULL AND NEW.type != 'sale' THEN
    NEW.sale_date := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the cleaner trigger
CREATE TRIGGER clean_activity_fields_trigger
  BEFORE INSERT OR UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION clean_activity_fields();