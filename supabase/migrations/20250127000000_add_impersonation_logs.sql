-- Create impersonation_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start_impersonation', 'end_impersonation')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for better query performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin_id ON public.impersonation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target_user_id ON public.impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_created_at ON public.impersonation_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view impersonation logs (idempotent)
DROP POLICY IF EXISTS "Admins can view impersonation logs" ON public.impersonation_logs;
CREATE POLICY "Admins can view impersonation logs" ON public.impersonation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Comment on table
COMMENT ON TABLE public.impersonation_logs IS 'Audit trail for user impersonation actions';
COMMENT ON COLUMN public.impersonation_logs.action IS 'Type of impersonation action: start_impersonation or end_impersonation';
