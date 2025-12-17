import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WelcomeEmailRequest {
  email: string;
  full_name: string;
  company_name: string;
}

serve(async (req) => {
  // Handle CORS preflight - must return 200 OK, not 204, to avoid browser CORS errors
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    // Parse request body
    let requestData: WelcomeEmailRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          email_sent: false
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const { email, full_name, company_name } = requestData;

    // Validate inputs
    if (!email || !full_name) {
      throw new Error('Missing required parameters: email and full_name');
    }

    // Use the onboarding simulator email system (encharge-send-email)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const firstName = full_name.split(' ')[0];
    
    // Call the encharge-send-email function (same as onboarding simulator)
    const enchargeFunctionUrl = `${SUPABASE_URL}/functions/v1/encharge-send-email`;
    
    const emailResponse = await fetch(enchargeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        template_type: 'welcome', // Uses the same template system as onboarding simulator
        to_email: email,
        to_name: firstName,
        variables: {
          user_name: firstName,
          full_name: full_name,
          company_name: company_name || '',
          first_name: firstName,
        },
      }),
    });

    if (!emailResponse.ok) {
      let errorData;
      try {
        errorData = await emailResponse.json();
      } catch (e) {
        errorData = { error: `HTTP ${emailResponse.status}: ${emailResponse.statusText}` };
      }
      console.error('encharge-send-email error:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorData
      });
      throw new Error(errorData.error || `Failed to send email: ${emailResponse.status} ${emailResponse.statusText}`);
    }

    let result;
    try {
      result = await emailResponse.json();
    } catch (e) {
      console.error('Failed to parse encharge-send-email response:', e);
      throw new Error('Invalid response from email service');
    }

    if (!result.success) {
      throw new Error(result.error || 'Email sending failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Welcome email sent successfully',
        email_sent: true,
        message_id: result.message_id
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Edge function error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        email_sent: false,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

// Template generation removed - now using encharge-send-email function
// which uses templates from the encharge_email_templates table
