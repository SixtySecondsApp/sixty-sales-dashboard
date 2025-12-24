/**
 * Clerk User Sync Edge Function
 *
 * This Edge Function handles synchronizing Clerk users to the clerk_user_mapping table.
 * It can be called:
 * 1. When a new user signs up via Clerk (webhook)
 * 2. When an existing Clerk user first accesses the app (auto-provision)
 * 3. Manually by an admin to sync all users
 *
 * This function runs on the INTERNAL project and can sync users to both
 * internal and external projects.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { captureException } from '../_shared/sentryEdge.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-clerk-webhook-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'EXTERNAL_SUPABASE_SERVICE_ROLE_KEY'
);

interface ClerkUser {
  id: string; // Clerk user ID (e.g., "user_2abc...")
  email_addresses: Array<{
    email_address: string;
    id: string;
    verification: { status: string };
  }>;
  primary_email_address_id: string;
  first_name?: string;
  last_name?: string;
  created_at: number;
  updated_at: number;
}

interface SyncRequest {
  action: 'provision' | 'sync_all' | 'webhook';
  clerk_user_id?: string;
  email?: string;
  full_name?: string;
  webhook_type?: string;
  data?: ClerkUser;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const internalSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create external Supabase client if configured
    const externalSupabase =
      EXTERNAL_SUPABASE_URL && EXTERNAL_SUPABASE_SERVICE_ROLE_KEY
        ? createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY)
        : null;

    const body: SyncRequest = await req.json();

    switch (body.action) {
      case 'provision':
        // Auto-provision a single user
        return await provisionUser(
          internalSupabase,
          externalSupabase,
          body.clerk_user_id!,
          body.email!,
          body.full_name
        );

      case 'webhook':
        // Handle Clerk webhook events
        return await handleWebhook(internalSupabase, externalSupabase, body);

      case 'sync_all':
        // Admin function to sync all users (requires admin auth)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return await syncAllUsers(internalSupabase, externalSupabase);

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in clerk-user-sync:', error);
    await captureException(error, {
      tags: {
        function: 'clerk-user-sync',
        integration: 'clerk',
      },
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Provision a single Clerk user to the mapping table
 */
async function provisionUser(
  internalSupabase: ReturnType<typeof createClient>,
  externalSupabase: ReturnType<typeof createClient> | null,
  clerkUserId: string,
  email: string,
  fullName?: string
) {
  console.log(`Provisioning user: ${clerkUserId} (${email})`);

  // Step 1: Check if mapping already exists in internal project
  const { data: existingMapping } = await internalSupabase
    .from('clerk_user_mapping')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (existingMapping) {
    console.log('User already mapped:', existingMapping);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User already mapped',
        mapping: existingMapping,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Step 2: Look for existing profile by email
  const { data: existingProfile } = await internalSupabase
    .from('profiles')
    .select('id, email, name')
    .eq('email', email.toLowerCase())
    .single();

  let supabaseUserId: string;

  if (existingProfile) {
    // User already has a profile, use that ID
    supabaseUserId = existingProfile.id;
    console.log('Found existing profile:', supabaseUserId);
  } else {
    // Create a new profile for this user
    // Generate a new UUID for the profile
    supabaseUserId = crypto.randomUUID();

    const { error: profileError } = await internalSupabase.from('profiles').insert({
      id: supabaseUserId,
      email: email.toLowerCase(),
      name: fullName || email.split('@')[0],
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to create profile', details: profileError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created new profile:', supabaseUserId);
  }

  // Step 3: Create the mapping in internal project
  const { error: mappingError } = await internalSupabase.from('clerk_user_mapping').insert({
    supabase_user_id: supabaseUserId,
    clerk_user_id: clerkUserId,
    email: email.toLowerCase(),
    migrated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (mappingError) {
    console.error('Error creating mapping in internal project:', mappingError);
    return new Response(
      JSON.stringify({ error: 'Failed to create mapping', details: mappingError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Step 4: Sync to external project if configured
  if (externalSupabase) {
    console.log('Syncing to external project...');

    // Create profile in external project
    const { error: extProfileError } = await externalSupabase.from('profiles').upsert({
      id: supabaseUserId,
      email: email.toLowerCase(),
      name: fullName || email.split('@')[0],
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (extProfileError) {
      console.warn('Warning: Failed to create profile in external project:', extProfileError);
    }

    // Create mapping in external project
    const { error: extMappingError } = await externalSupabase
      .from('clerk_user_mapping')
      .upsert({
        supabase_user_id: supabaseUserId,
        clerk_user_id: clerkUserId,
        email: email.toLowerCase(),
        migrated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'clerk_user_id' });

    if (extMappingError) {
      console.warn('Warning: Failed to create mapping in external project:', extMappingError);
    }
  }

  console.log('User provisioned successfully');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'User provisioned successfully',
      supabase_user_id: supabaseUserId,
      clerk_user_id: clerkUserId,
      synced_to_external: !!externalSupabase,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle Clerk webhook events
 */
async function handleWebhook(
  internalSupabase: ReturnType<typeof createClient>,
  externalSupabase: ReturnType<typeof createClient> | null,
  body: SyncRequest
) {
  const webhookType = body.webhook_type;
  const clerkUser = body.data;

  if (!clerkUser) {
    return new Response(
      JSON.stringify({ error: 'No user data in webhook' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`Processing webhook: ${webhookType} for user ${clerkUser.id}`);

  // Get primary email
  const primaryEmail = clerkUser.email_addresses.find(
    (e) => e.id === clerkUser.primary_email_address_id
  )?.email_address;

  if (!primaryEmail) {
    return new Response(
      JSON.stringify({ error: 'No primary email found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const fullName = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ');

  switch (webhookType) {
    case 'user.created':
      // New user signed up - provision them
      return await provisionUser(
        internalSupabase,
        externalSupabase,
        clerkUser.id,
        primaryEmail,
        fullName || undefined
      );

    case 'user.updated':
      // User updated - update their profile
      const { data: mapping } = await internalSupabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', clerkUser.id)
        .single();

      if (mapping) {
        await internalSupabase
          .from('profiles')
          .update({
            email: primaryEmail.toLowerCase(),
            name: fullName || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.supabase_user_id);

        // Sync to external project
        if (externalSupabase) {
          await externalSupabase
            .from('profiles')
            .update({
              email: primaryEmail.toLowerCase(),
              name: fullName || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', mapping.supabase_user_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    case 'user.deleted':
      // User deleted - we don't delete profiles, just log it
      console.log(`User ${clerkUser.id} deleted in Clerk`);
      return new Response(
        JSON.stringify({ success: true, message: 'User deletion logged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    default:
      return new Response(
        JSON.stringify({ success: true, message: `Unhandled webhook type: ${webhookType}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
}

/**
 * Admin function to sync all existing users
 */
async function syncAllUsers(
  internalSupabase: ReturnType<typeof createClient>,
  externalSupabase: ReturnType<typeof createClient> | null
) {
  // Get all profiles that don't have a clerk mapping
  const { data: unmappedProfiles, error } = await internalSupabase
    .from('profiles')
    .select('id, email, name')
    .not('id', 'in', (
      await internalSupabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
    ).data?.map((m: { supabase_user_id: string }) => m.supabase_user_id) || []);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch unmapped profiles', details: error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // For sync_all, we just return the list of unmapped users
  // Actual Clerk user IDs need to be provided separately
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Use the Clerk Dashboard to create users, then call provision for each',
      unmapped_profiles: unmappedProfiles,
      external_project_configured: !!externalSupabase,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
