import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('VITE_SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rpcFunction = `
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

GRANT EXECUTE ON FUNCTION public.get_users_with_targets() TO authenticated;
`;

async function fixRpcFunction() {
  console.log('Applying RPC function to Supabase...');
  
  try {
    const { error } = await supabase.rpc('exec', {
      sql: rpcFunction
    });
    
    if (error) {
      console.error('Error creating RPC function:', error);
      process.exit(1);
    }
    
    console.log('✅ RPC function get_users_with_targets created successfully');
  } catch (error) {
    console.error('Failed to create RPC function:', error);
    process.exit(1);
  }
}

fixRpcFunction();