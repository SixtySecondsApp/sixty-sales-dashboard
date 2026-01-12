import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/ses.ts'
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
    const { email, first_name, last_name, redirectTo, invitedByAdminId } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!redirectTo) {
      return new Response(
        JSON.stringify({ error: 'redirectTo is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the admin user from the JWT token to verify they're an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin user is an admin
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single()

    if (!adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: `User with email ${email} already exists` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate invitation link using Supabase admin API
    // Note: We use inviteUserByEmail which sends an invitation email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: {
          first_name: first_name || undefined,
          last_name: last_name || undefined,
          full_name: first_name && last_name ? `${first_name} ${last_name}` : undefined,
          invited_by_admin_id: invitedByAdminId,
        },
        redirectTo: redirectTo,
      }
    )

    if (inviteError) {
      console.error('Error generating invitation:', inviteError)
      throw new Error(`Failed to generate invitation: ${inviteError.message}`)
    }

    if (!inviteData?.user?.id) {
      throw new Error('No user ID returned from invitation')
    }

    // Extract the confirmation token from the response if available
    // The actual email will be sent by Supabase, but we can send a custom one if needed
    console.log('Invitation sent successfully:', {
      userId: inviteData.user.id,
      email: inviteData.user.email,
      first_name,
      last_name,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        userId: inviteData.user.id,
        email: inviteData.user.email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in invite-user:', error)
    await captureException(error, {
      tags: {
        function: 'invite-user',
        integration: 'supabase-auth',
      },
    })
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
