/**
 * Vercel API Route: Fathom Webhook Proxy
 *
 * Provides a branded webhook URL for Fathom integration.
 * Proxies webhook payloads to the Supabase Edge Function.
 *
 * Branded URL: https://use60.com/api/webhooks/fathom
 * Proxies to: {SUPABASE_URL}/functions/v1/fathom-webhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Fathom-Signature');
    return res.status(200).end();
  }

  // Only allow POST requests (webhooks are POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Webhooks must use POST.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('[fathom-webhook-proxy] Missing SUPABASE_URL');
      throw new Error('Webhook endpoint not configured');
    }

    if (!supabaseServiceKey) {
      console.error('[fathom-webhook-proxy] Missing SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Webhook endpoint not configured');
    }

    // Get the raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Forward all relevant headers from Fathom
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    };

    // Forward Fathom signature header if present
    const fathomSignature = req.headers['x-fathom-signature'] || req.headers['fathom-signature'];
    if (fathomSignature) {
      forwardHeaders['X-Fathom-Signature'] = Array.isArray(fathomSignature) ? fathomSignature[0] : fathomSignature;
    }

    // Proxy to Supabase Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fathom-webhook`;

    console.log(`[fathom-webhook-proxy] Forwarding webhook to ${edgeFunctionUrl}`);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: rawBody,
    });

    const responseText = await response.text();

    // Try to parse as JSON, fallback to text
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error(`[fathom-webhook-proxy] Edge function error: ${response.status} - ${responseText}`);
      return res.status(response.status).json({
        success: false,
        error: responseData.error || 'Webhook processing failed',
        ...responseData,
      });
    }

    console.log('[fathom-webhook-proxy] Webhook processed successfully');

    return res.status(200).json({
      success: true,
      ...responseData,
      proxiedBy: 'use60-webhook-proxy',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[fathom-webhook-proxy] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
