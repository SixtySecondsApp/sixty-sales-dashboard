-- Migration: Add AI metrics + thumbnail support for recordings (MeetingBaaS)
-- Date: 2026-01-22
--
-- Purpose:
-- - Edge functions already compute these fields for MeetingBaaS recordings:
--   - sentiment_score, coach_rating, coach_summary, talk_time_*, thumbnail_*
-- - Frontend UI expects recordings.thumbnail_url and AI badges.
-- - Baseline schema does not yet include these columns.

-- =============================================================================
-- 1) AI metric columns
-- =============================================================================

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS sentiment_score numeric
    CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1));

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS coach_rating numeric
    CHECK (coach_rating IS NULL OR (coach_rating >= 0 AND coach_rating <= 100));

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS coach_summary text;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS talk_time_rep_pct numeric;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS talk_time_customer_pct numeric;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS talk_time_judgement text
    CHECK (talk_time_judgement IS NULL OR talk_time_judgement IN ('good', 'high', 'low'));

-- =============================================================================
-- 2) Thumbnail columns (real video-frame thumbnails stored in S3)
-- =============================================================================

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS thumbnail_s3_key text;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- =============================================================================
-- 3) Optional linkage to unified meetings row (used by some sync flows)
-- =============================================================================

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS meeting_id uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meetings') THEN
    ALTER TABLE public.recordings
      ADD CONSTRAINT recordings_meeting_id_fkey
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id
  ON public.recordings(meeting_id)
  WHERE meeting_id IS NOT NULL;

