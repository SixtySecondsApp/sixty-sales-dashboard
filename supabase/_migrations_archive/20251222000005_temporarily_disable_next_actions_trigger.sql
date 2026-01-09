-- Temporarily disable the next_actions trigger
-- This allows transcript processing to work while we fix the missing function

DROP TRIGGER IF EXISTS trigger_auto_suggest_next_actions_meeting ON public.meetings;
