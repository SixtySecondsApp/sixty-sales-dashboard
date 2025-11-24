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
      contactsWithEmails: 0,
      errors: [] as string[],
    };

    for (const user of activeUsers) {
      try {
        // Get user's CRM contacts with emails
        // NOTE: contacts table uses owner_id, not user_id
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, email')
          .eq('owner_id', user.id)
          .not('email', 'is', null);

        if (contactsError) {
          throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
        }

        if (!contacts || contacts.length === 0) {
          // Skip users with no CRM contacts
          continue;
        }

        results.contactsWithEmails += contacts.length;

        // Fetch emails from Gmail API (last 24 hours only for incremental sync)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const afterTimestamp = Math.floor(oneDayAgo.getTime() / 1000);

        // Call Gmail edge function to fetch recent emails
        const { data: gmailData, error: gmailError } = await supabase.functions.invoke('google-gmail', {
          body: {
            action: 'list',
            query: `after:${afterTimestamp}`,
            maxResults: 100, // Limit for daily sync
            userId: user.id,
          },
        });

        if (gmailError) {
          // If Gmail integration is not set up or has errors, skip this user
          // Don't throw - continue with other users
          results.errors.push(`User ${user.id} Gmail error: ${gmailError.message}`);
          continue;
        }

        const messages = gmailData?.messages || [];

        // Create a set of CRM contact emails for matching
        const crmEmails = new Set(
          contacts
            .map(c => c.email?.toLowerCase().trim())
            .filter((email): email is string => Boolean(email))
        );

        // Process each email and store if it matches a CRM contact
        let emailsStoredForUser = 0;
        for (const message of messages) {
          try {
            // Extract email addresses from headers
            const headers = message.payload?.headers || [];
            const fromHeader = headers.find((h: any) => h.name === 'From');
            const toHeader = headers.find((h: any) => h.name === 'To');
            const subjectHeader = headers.find((h: any) => h.name === 'Subject');
            const dateHeader = headers.find((h: any) => h.name === 'Date');

            // Extract from email
            const fromMatch = fromHeader?.value?.match(/<([^>]+)>/) ||
                              fromHeader?.value?.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
            const fromEmail = fromMatch ? fromMatch[1] : fromHeader?.value;

            // Extract to emails
            const toEmails = toHeader?.value?.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || [];

            // Check if email involves a CRM contact
            const normalizedFrom = fromEmail?.toLowerCase().trim();
            const matchesCRM = (normalizedFrom && crmEmails.has(normalizedFrom)) ||
                               toEmails.some(e => crmEmails.has(e.toLowerCase().trim()));

            if (!matchesCRM) {
              continue; // Skip non-CRM emails
            }

            // Find matching contact
            let contactId = null;
            if (normalizedFrom && crmEmails.has(normalizedFrom)) {
              const contact = contacts.find(c => c.email?.toLowerCase().trim() === normalizedFrom);
              contactId = contact?.id || null;
            } else {
              // Check recipients
              for (const toEmail of toEmails) {
                const normalized = toEmail.toLowerCase().trim();
                if (crmEmails.has(normalized)) {
                  const contact = contacts.find(c => c.email?.toLowerCase().trim() === normalized);
                  if (contact) {
                    contactId = contact.id;
                    break;
                  }
                }
              }
            }

            // Store as communication event (without AI analysis for now)
            // AI analysis can be done asynchronously later
            const { error: insertError } = await supabase
              .from('communication_events')
              .insert({
                user_id: user.id,
                contact_id: contactId,
                event_type: 'email_received', // Simplified - could detect sent vs received
                communication_date: dateHeader ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
                subject: subjectHeader?.value || '',
                summary: `Email: ${subjectHeader?.value || '(no subject)'}`,
                external_id: message.id,
                metadata: {
                  from: fromEmail,
                  to: toEmails,
                  gmail_message_id: message.id,
                  synced_at: new Date().toISOString(),
                },
              })
              .select('id')
              .single();

            if (!insertError) {
              emailsStoredForUser++;
            }
          } catch (emailError: any) {
            // Continue processing other emails even if one fails
            console.error(`Error processing email ${message.id}:`, emailError);
          }
        }

        results.emailsSynced += emailsStoredForUser;
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

