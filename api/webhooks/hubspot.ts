/**
 * Vercel API Route: HubSpot Webhook Proxy
 *
 * Branded URL: /api/webhooks/hubspot?token=<webhook_token>
 * Proxies to: {SUPABASE_URL}/functions/v1/hubspot-webhook?token=<webhook_token>
 *
 * Security:
 * - Adds internal Use60 signature (X-Use60-Timestamp, X-Use60-Signature)
 * - Forwards HubSpot signature headers + original URL so the edge function can verify
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hmacSha256Hex } from '../lib/signing';
import { withOtel } from '../lib/withOtel';

function getHeader(req: VercelRequest, name: string): string | null {
  const v = (req.headers as any)[name.toLowerCase()];
  if (!v) return null;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof (req as any).body === 'string') return (req as any).body;
  if (Buffer.isBuffer((req as any).body)) return ((req as any).body as Buffer).toString('utf8');

  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  } catch {
    // ignore
  }

  return JSON.stringify((req as any).body ?? {});
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      [
        'Content-Type',
        'Authorization',
        'X-HubSpot-Signature',
        'X-HubSpot-Signature-Version',
        'X-HubSpot-Signature-v3',
        'X-HubSpot-Request-Timestamp',
      ].join(', ')
    );
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Webhooks must use POST.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proxySecret = process.env.HUBSPOT_WEBHOOK_PROXY_SECRET;

    if (!supabaseUrl || !supabaseServiceKey || !proxySecret) {
      console.error('[hubspot-webhook-proxy] Missing env (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/HUBSPOT_WEBHOOK_PROXY_SECRET)');
      throw new Error('Webhook endpoint not configured');
    }

    const rawBody = await readRawBody(req);
    const ts = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `v1:${ts}:${rawBody}`;
    const sig = hmacSha256Hex(proxySecret, signedPayload);

    const queryToken = typeof (req.query as any)?.token === 'string' ? String((req.query as any).token) : '';
    const qs = queryToken ? `?token=${encodeURIComponent(queryToken)}` : '';

    const forwardHeaders: Record<string, string> = {
      'Content-Type': getHeader(req, 'content-type') || 'application/json',
      Authorization: `Bearer ${supabaseServiceKey}`,
      'X-Use60-Timestamp': ts,
      'X-Use60-Signature': `v1=${sig}`,
      // Give the edge function the original URL HubSpot called (needed for signature verification)
      'X-Use60-Original-Url': `https://${req.headers.host}${req.url}`,
    };

    // Forward HubSpot signature headers
    const sigV1 = getHeader(req, 'x-hubspot-signature');
    const sigVer = getHeader(req, 'x-hubspot-signature-version');
    const sigV3 = getHeader(req, 'x-hubspot-signature-v3');
    const reqTs = getHeader(req, 'x-hubspot-request-timestamp');

    if (sigV1) forwardHeaders['x-hubspot-signature'] = sigV1;
    if (sigVer) forwardHeaders['x-hubspot-signature-version'] = sigVer;
    if (sigV3) forwardHeaders['x-hubspot-signature-v3'] = sigV3;
    if (reqTs) forwardHeaders['x-hubspot-request-timestamp'] = reqTs;

    const edgeUrl = `${supabaseUrl}/functions/v1/hubspot-webhook${qs}`;

    const response = await fetch(edgeUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: rawBody,
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error(`[hubspot-webhook-proxy] Edge function error: ${response.status} - ${responseText}`);
      return res.status(response.status).json({
        success: false,
        error: responseData.error || 'Webhook processing failed',
        ...responseData,
      });
    }

    return res.status(200).json({
      success: true,
      ...responseData,
      proxiedBy: 'use60-webhook-proxy',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[hubspot-webhook-proxy] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

export default withOtel('api.webhooks.hubspot', handler);


