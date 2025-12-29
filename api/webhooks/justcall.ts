/**
 * Vercel API Route: JustCall Webhook Proxy
 *
 * Branded URL: /api/webhooks/justcall?token=<webhook_token>
 * Proxies to: {SUPABASE_URL}/functions/v1/justcall-webhook?token=<webhook_token>
 *
 * Security:
 * - Adds internal Use60 signature (X-Use60-Timestamp, X-Use60-Signature)
 * - Optionally, the edge function can validate JustCall's own dynamic signature
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hmacSha256Hex } from '../_shared/signing';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-JustCall-Signature, X-JustCall-Signature-Version, X-JustCall-Request-Timestamp'
    );
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Webhooks must use POST.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proxySecret = process.env.JUSTCALL_WEBHOOK_PROXY_SECRET;

    if (!supabaseUrl || !supabaseServiceKey || !proxySecret) {
      console.error('[justcall-webhook-proxy] Missing env (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/JUSTCALL_WEBHOOK_PROXY_SECRET)');
      throw new Error('Webhook endpoint not configured');
    }

    const rawBody = await readRawBody(req);
    const ts = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `v1:${ts}:${rawBody}`;
    const sig = hmacSha256Hex(proxySecret, signedPayload);

    const queryToken = typeof (req.query as any)?.token === 'string' ? String((req.query as any).token) : '';
    const qs = queryToken ? `?token=${encodeURIComponent(queryToken)}` : '';

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseServiceKey}`,
      'X-Use60-Timestamp': ts,
      'X-Use60-Signature': `v1=${sig}`,
    };

    // Forward JustCall dynamic signature headers (edge function verifies with org secret)
    const jcSig = getHeader(req, 'x-justcall-signature');
    const jcSigVer = getHeader(req, 'x-justcall-signature-version');
    const jcTs = getHeader(req, 'x-justcall-request-timestamp');

    if (jcSig) forwardHeaders['x-justcall-signature'] = jcSig;
    if (jcSigVer) forwardHeaders['x-justcall-signature-version'] = jcSigVer;
    if (jcTs) forwardHeaders['x-justcall-request-timestamp'] = jcTs;

    const edgeUrl = `${supabaseUrl}/functions/v1/justcall-webhook${qs}`;

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
      console.error(`[justcall-webhook-proxy] Edge function error: ${response.status} - ${responseText}`);
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
    console.error('[justcall-webhook-proxy] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}













