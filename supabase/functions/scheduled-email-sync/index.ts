/**
 * Scheduled Email Sync Edge Function
 * 
 * Daily incremental email sync for active users (logged in last 7 days).
 * Syncs last 24 hours of emails for CRM contacts only.
 * Called daily via GitHub Actions cron job.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify cron secret (if set)
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (cronSecret && providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get active users (logged in last 7 days) with Gmail integration
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        google_integrations!inner(id, is_active)
      `)
      .gte('last_login_at', sevenDaysAgo.toISOString())
      .not('last_login_at', 'is', null)
      .eq('google_integrations.is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch active users: ${usersError.message}`);
    }

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active users with Gmail integration to sync',
          usersProcessed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync emails for each active user
    const results = {
      usersProcessed: 0,
      emailsSynced: 0,
      errors: [] as string[],
    };

    for (const user of activeUsers) {
      try {
        // Call email sync for this user (incremental - last 24 hours)
        // Note: This would need to call the email sync service logic
        // For now, we'll trigger it via a database function or direct API call
        
        // Get user's CRM contacts count
        // NOTE: contacts table uses owner_id, not user_id
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .not('email', 'is', null);

        if (!contacts || contacts.length === 0) {
          // Skip users with no CRM contacts
          continue;
        }

        // Trigger email sync via RPC or direct service call
        // For now, we'll log that sync should happen
        // In production, you'd call the email sync service here
        
        results.usersProcessed++;
      } catch (error: any) {
        results.errors.push(`User ${user.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        ...results,
        timestamp: new Date().toISOString(),
        note: 'Email sync logic needs to be implemented - this is a placeholder',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Email sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

