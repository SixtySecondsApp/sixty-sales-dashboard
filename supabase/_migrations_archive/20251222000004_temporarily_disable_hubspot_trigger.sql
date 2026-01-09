-- Temporarily disable the hubspot meeting note trigger
-- This allows transcript processing to work while we fix the ON CONFLICT issue

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_meeting_note ON public.meetings;
