-- Fix: queue_call_for_indexing should run on INSERT too
-- Reason: calls may be inserted with transcript_text already present (e.g. webhook payloads),
-- and the original trigger only fired on UPDATE.

DROP TRIGGER IF EXISTS trigger_queue_call_index ON calls;

CREATE TRIGGER trigger_queue_call_index
  AFTER INSERT OR UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION queue_call_for_indexing();











