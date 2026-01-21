/**
 * Generate Waitlist Token Edge Function
 *
 * Generates a custom magic token for waitlist invitations
 * Tokens expire after 24 hours and can only be used once
 * This allows full control over the signup flow without Supabase auto-creating users
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerateTokenRequest {
  waitlist_entry_id: string;
  email: string;
}

// Generate a secure random token (64-character hex string)
function generateSecureToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request: GenerateTokenRequest = await req.json();

    if (!request.waitlist_entry_id || !request.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing waitlist_entry_id or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with explicit service role configuration
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
    });

    // Generate token
    const token = generateSecureToken();

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // First verify the waitlist entry exists before inserting token
    const { data: entryExists, error: entryCheckError } = await supabaseAdmin
      .from('meetings_waitlist')
      .select('id')
      .eq('id', request.waitlist_entry_id)
      .maybeSingle();

    if (entryCheckError) {
      console.error('Error checking waitlist entry:', entryCheckError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify waitlist entry',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!entryExists) {
      console.error('Waitlist entry not found:', request.waitlist_entry_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Waitlist entry not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert token into database
    const { data, error } = await supabaseAdmin
      .from('waitlist_magic_tokens')
      .insert({
        token,
        waitlist_entry_id: request.waitlist_entry_id,
        email: request.email.toLowerCase(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create token:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Failed to generate token',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token generated successfully for:', request.email);

    return new Response(
      JSON.stringify({
        success: true,
        token: data.token,
        expiresAt: data.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating token:', {
      message: error.message,
      stack: error.stack,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
