-- ADD MISSING TABLES TO DEV DATABASE
-- Run this in Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr/sql/new
-- Project: jczngsvpywgrlgdwzjbr (Development)

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  workflow_execution_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM public.notifications
  WHERE user_id = auth.uid() AND read = FALSE;
  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT ALL ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- ============================================================================
-- 2. GOOGLE INTEGRATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.google_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON public.google_integrations(user_id);

ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own Google integrations" ON public.google_integrations;
CREATE POLICY "Users can view their own Google integrations" ON public.google_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own Google integrations" ON public.google_integrations;
CREATE POLICY "Users can insert their own Google integrations" ON public.google_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own Google integrations" ON public.google_integrations;
CREATE POLICY "Users can update their own Google integrations" ON public.google_integrations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own Google integrations" ON public.google_integrations;
CREATE POLICY "Users can delete their own Google integrations" ON public.google_integrations
  FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.google_integrations TO authenticated;

-- Function to get user's Google integration
CREATE OR REPLACE FUNCTION public.get_my_google_integration()
RETURNS SETOF public.google_integrations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.google_integrations
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_my_google_integration() TO authenticated;

-- ============================================================================
-- 3. FIX ACTIVITIES TABLE - Add deals relationship if missing
-- ============================================================================
-- Add deal_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'deal_id'
  ) THEN
    ALTER TABLE public.activities ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id);
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFY SETUP
-- ============================================================================
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notifications', 'google_integrations', 'activities', 'deals', 'profiles')
ORDER BY table_name;
