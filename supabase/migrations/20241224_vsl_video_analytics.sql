-- VSL Video Analytics Table
-- Tracks video engagement events for split testing landing page videos

CREATE TABLE IF NOT EXISTS public.vsl_video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Video identification
  signup_source TEXT NOT NULL, -- e.g., 'intro-vsl', 'introducing-vsl', 'introduction-vsl'
  video_public_id TEXT NOT NULL, -- Cloudinary public ID

  -- Event data
  event_type TEXT NOT NULL, -- 'view', 'play', 'pause', 'progress', 'ended', 'seek'

  -- Watch metrics
  playback_time NUMERIC DEFAULT 0, -- Current playback position in seconds
  duration NUMERIC DEFAULT 0, -- Total video duration in seconds
  progress_percent NUMERIC DEFAULT 0, -- Percentage watched (0-100)
  watch_time NUMERIC DEFAULT 0, -- Cumulative watch time in seconds

  -- Session tracking (anonymous)
  session_id TEXT NOT NULL, -- Anonymous session identifier

  -- Metadata
  user_agent TEXT,
  referrer TEXT,
  screen_width INTEGER,
  screen_height INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_vsl_analytics_signup_source ON public.vsl_video_analytics(signup_source);
CREATE INDEX IF NOT EXISTS idx_vsl_analytics_event_type ON public.vsl_video_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_vsl_analytics_created_at ON public.vsl_video_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_vsl_analytics_session_id ON public.vsl_video_analytics(session_id);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_vsl_analytics_source_event_date ON public.vsl_video_analytics(signup_source, event_type, created_at);

-- RLS Configuration for Public Analytics Table
-- NOTE: RLS is DISABLED for this table because:
-- 1. It only stores anonymous video engagement metrics (no sensitive data)
-- 2. Write access is needed from unauthenticated landing page visitors
-- 3. PostgREST cache issues prevented policies from working reliably
-- 4. The table is essentially write-only from public perspective
ALTER TABLE public.vsl_video_analytics DISABLE ROW LEVEL SECURITY;

-- Grant explicit permissions
GRANT INSERT ON public.vsl_video_analytics TO anon;
GRANT INSERT ON public.vsl_video_analytics TO authenticated;
GRANT SELECT ON public.vsl_video_analytics TO authenticated;

-- View for aggregated analytics (used by dashboard)
CREATE OR REPLACE VIEW public.vsl_analytics_summary AS
SELECT
  signup_source,
  video_public_id,
  DATE(created_at) as date,

  -- View metrics
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'view') as unique_views,
  COUNT(*) FILTER (WHERE event_type = 'view') as total_views,

  -- Play metrics
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'play') as unique_plays,
  COUNT(*) FILTER (WHERE event_type = 'play') as total_plays,

  -- Completion metrics
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'ended') as completions,

  -- Progress milestones
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 25) as reached_25,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 50) as reached_50,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 75) as reached_75,

  -- Average watch time (from ended events)
  AVG(watch_time) FILTER (WHERE event_type = 'ended') as avg_watch_time,

  -- Average progress (from ended events)
  AVG(progress_percent) FILTER (WHERE event_type = 'ended') as avg_completion_percent

FROM public.vsl_video_analytics
GROUP BY signup_source, video_public_id, DATE(created_at);

-- Grant access to the view
GRANT SELECT ON public.vsl_analytics_summary TO authenticated;

COMMENT ON TABLE public.vsl_video_analytics IS 'Tracks video engagement events for VSL split testing';
COMMENT ON VIEW public.vsl_analytics_summary IS 'Aggregated VSL analytics for dashboard display';
