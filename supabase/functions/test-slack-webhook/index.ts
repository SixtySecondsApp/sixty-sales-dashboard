import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { webhookUrl } = await req.json();

    if (!webhookUrl) {
      throw new Error('Webhook URL is required');
    }

    const testMessage = {
      text: '✅ Sixty Sales Slack integration test successful!',
      attachments: [{
        color: '#36a64f',
        text: 'Your Slack webhook is properly configured and ready to receive workflow notifications.',
        footer: 'Sixty Sales',
        footer_icon: 'https://sixty.app/favicon.ico',
        ts: Math.floor(Date.now() / 1000),
      }],
    };

    // Send test message to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack webhook test error:', errorText);
      throw new Error(`Slack webhook test failed: ${response.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Test message sent to Slack!' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error testing Slack webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});