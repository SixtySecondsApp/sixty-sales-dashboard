import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentryEdge.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the admin user from the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin user is a platform admin (internal + is_admin)
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single()

    // Internal domain allowlist check (fail-closed; bootstrap domain fallback if table missing)
    const adminEmail = adminUser.email?.toLowerCase() || ''
    if (adminEmail === 'app@sixtyseconds.video') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const adminDomain = adminEmail.includes('@') ? adminEmail.split('@').pop() : null

    let isInternal = false
    if (adminDomain) {
      const { data: internalDomain, error: domainError } = await supabaseAdmin
        .from('internal_email_domains')
        .select('domain')
        .eq('domain', adminDomain)
        .eq('is_active', true)
        .maybeSingle()

      if (domainError && (domainError as any)?.code === '42P01') {
        isInternal = adminDomain === 'sixtyseconds.video'
      } else if (!domainError && internalDomain) {
        isInternal = true
      }
    }

    if (!adminProfile?.is_admin || !isInternal) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-deletion
    if (adminUser.id === userId) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user email before deletion for cleanup
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete from profiles (this will cascade to related records if foreign keys are set up)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return new Response(
        JSON.stringify({ error: `Failed to delete profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to delete from auth.users (may fail if user doesn't exist there, which is okay)
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId)
    } catch (authError: any) {
      // It's okay if auth user doesn't exist - profile might have been created without auth
      console.log('Note: Could not delete auth user (may not exist):', authError.message)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully',
        userId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in delete-user:', error)
    await captureException(error, {
      tags: {
        function: 'delete-user',
        integration: 'supabase-auth',
      },
    });
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
