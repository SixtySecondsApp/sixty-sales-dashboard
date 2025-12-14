-- Create rate_limit table for Edge Function rate limiting
-- This table tracks API requests per user and endpoint for rate limiting

CREATE TABLE IF NOT EXISTS public.rate_limit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint ON public.rate_limit(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at ON public.rate_limit(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_created ON public.rate_limit(user_id, created_at);

-- Enable RLS
ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own rate limit records
CREATE POLICY "Users can view their own rate limit records"
  ON public.rate_limit
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role can manage rate limit records"
  ON public.rate_limit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow Edge Functions to insert rate limit records
CREATE POLICY "Authenticated users can insert rate limit records"
  ON public.rate_limit
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.rate_limit TO authenticated;
GRANT ALL ON public.rate_limit TO service_role;

-- Create a function to clean up old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

