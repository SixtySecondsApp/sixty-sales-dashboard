-- ============================================================================
-- Migration: Fix deal history trigger functions search_path
-- ============================================================================
-- Issue: handle_deal_insert() and handle_deal_stage_change() have
-- SET search_path TO '' (empty) but reference deal_stage_history without
-- the public. schema prefix. This causes "relation does not exist" error.
-- Fix: Change search_path to 'public' so the functions can find the tables.
-- ============================================================================

-- Fix handle_deal_insert function
CREATE OR REPLACE FUNCTION public.handle_deal_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO deal_stage_history (deal_id, stage_id, user_id, entered_at)
    VALUES (NEW.id, NEW.stage_id, NEW.owner_id, NEW.created_at);
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_deal_insert() IS 'Inserts initial deal stage history record when a deal is created';

-- Fix handle_deal_stage_change function
CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  previous_stage_id UUID;
  previous_entry_id UUID;
BEGIN
  -- Check if the stage_id actually changed
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN

    -- Find the most recent previous history entry for this deal that hasn't exited
    SELECT id, stage_id INTO previous_entry_id, previous_stage_id
    FROM deal_stage_history
    WHERE deal_id = NEW.id AND exited_at IS NULL
    ORDER BY entered_at DESC
    LIMIT 1;

    -- If a previous entry exists, update its exited_at and duration
    IF previous_entry_id IS NOT NULL THEN
      UPDATE deal_stage_history
      SET
        exited_at = NEW.stage_changed_at,
        duration_seconds = EXTRACT(EPOCH FROM (NEW.stage_changed_at - entered_at))::INTEGER
      WHERE id = previous_entry_id;
    END IF;

    -- Insert the new stage history record
    INSERT INTO deal_stage_history (deal_id, stage_id, user_id, entered_at)
    VALUES (NEW.id, NEW.stage_id, NEW.owner_id, NEW.stage_changed_at);

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_deal_stage_change() IS 'Tracks deal stage transitions by updating exit times and creating new history records';

-- Ensure the triggers exist on the deals table
DROP TRIGGER IF EXISTS trigger_deal_insert_history ON deals;
CREATE TRIGGER trigger_deal_insert_history
  AFTER INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION handle_deal_insert();

DROP TRIGGER IF EXISTS trigger_deal_stage_change_history ON deals;
CREATE TRIGGER trigger_deal_stage_change_history
  AFTER UPDATE OF stage_id ON deals
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION handle_deal_stage_change();
