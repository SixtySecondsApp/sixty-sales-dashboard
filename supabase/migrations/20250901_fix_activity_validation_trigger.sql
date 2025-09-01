-- Fix the activity validation trigger to handle partial updates correctly
CREATE OR REPLACE FUNCTION validate_outbound_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Use COALESCE to handle partial updates where type might not be in the update
  -- For UPDATE operations, NEW.type will be the new value if provided, or the old value if not
  
  -- For outbound activities, ensure outbound_type is set
  IF COALESCE(NEW.type, OLD.type) = 'outbound' AND NEW.outbound_type IS NULL THEN
    -- Only raise exception on INSERT or if we're actually trying to clear outbound_type
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.outbound_type IS NOT NULL) THEN
      RAISE EXCEPTION 'Outbound activities must have an outbound_type specified';
    END IF;
  END IF;
  
  -- For non-outbound activities, clear outbound_type if it was accidentally set
  IF COALESCE(NEW.type, OLD.type) != 'outbound' AND NEW.outbound_type IS NOT NULL THEN
    NEW.outbound_type := NULL;
  END IF;
  
  -- For non-meeting activities, clear meeting-specific flags
  IF COALESCE(NEW.type, OLD.type) != 'meeting' THEN
    NEW.is_rebooking := FALSE;
    NEW.is_self_generated := FALSE;
  END IF;
  
  -- For non-proposal activities, clear proposal_date
  IF COALESCE(NEW.type, OLD.type) != 'proposal' AND NEW.proposal_date IS NOT NULL THEN
    NEW.proposal_date := NULL;
  END IF;
  
  -- For non-sale activities, clear sale_date
  IF COALESCE(NEW.type, OLD.type) != 'sale' AND NEW.sale_date IS NOT NULL THEN
    NEW.sale_date := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS validate_outbound_activity_trigger ON activities;
CREATE TRIGGER validate_outbound_activity_trigger
  BEFORE INSERT OR UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION validate_outbound_activity();