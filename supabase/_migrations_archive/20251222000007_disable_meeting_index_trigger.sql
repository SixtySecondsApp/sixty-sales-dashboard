-- Temporarily disable the meeting index queue trigger
-- This is causing transcript updates to fail

DROP TRIGGER IF EXISTS trigger_queue_meeting_index ON public.meetings;
