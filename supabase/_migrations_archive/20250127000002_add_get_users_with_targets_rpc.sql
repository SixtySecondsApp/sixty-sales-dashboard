-- Create RPC function to get users with their targets
CREATE OR REPLACE FUNCTION public.get_users_with_targets()
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  stage TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  targets JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(p.email, au.email) as email,
    p.first_name,
    p.last_name,
    COALESCE(p.stage, 'Trainee') as stage,
    p.avatar_url,
    COALESCE(p.is_admin, false) as is_admin,
    COALESCE(p.created_at, p.updated_at, au.created_at) as created_at,
    au.last_sign_in_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'user_id', t.user_id,
            'revenue_target', t.revenue_target,
            'outbound_target', t.outbound_target,
            'meetings_target', t.meetings_target,
            'proposal_target', t.proposal_target,
            'start_date', t.start_date,
            'end_date', t.end_date,
            'created_at', t.created_at,
            'updated_at', t.updated_at
          )
        )
        FROM public.targets t
        WHERE t.user_id = p.id
      ),
      '[]'::jsonb
    ) as targets
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_users_with_targets() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_users_with_targets() IS 'Returns all users with their profile information and targets';