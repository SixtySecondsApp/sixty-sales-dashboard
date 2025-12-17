import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // user-auth (admin-only)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const userToken = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
  if (!anonKey || !userToken) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const svc = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = await req.json().catch(() => ({}))
  const orgId = typeof body.org_id === 'string' ? body.org_id : null
  if (!orgId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing org_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify org admin (owner/admin) membership
  const { data: membership } = await svc
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  const role = membership?.role as string | undefined
  const isAdmin = role === 'owner' || role === 'admin'
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await svc
    .from('hubspot_org_integrations')
    .update({
      is_active: false,
      is_connected: false,
      webhook_last_received_at: null,
      webhook_last_event_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)

  // Credentials remain stored but effectively disabled; rotate webhook token for safety.
  await svc
    .from('hubspot_org_integrations')
    .update({ webhook_token: crypto.randomUUID().replace(/-/g, '') })
    .eq('org_id', orgId)
    .catch(() => {})

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})


