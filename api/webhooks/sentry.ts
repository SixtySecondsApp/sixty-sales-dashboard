/**
 * Vercel API Route: Sentry Webhook Proxy
 *
 * Provides a branded webhook URL for Sentry integration.
 * Proxies webhook payloads to the Supabase Edge Function.
 *
 * Branded URL: https://use60.com/api/webhooks/sentry?org_id={org_id}
 * Proxies to: {SUPABASE_URL}/functions/v1/sentry-webhook
 *
 * Authentication chain:
 * 1. Sentry → Vercel: Sentry webhook signature verification
 * 2. Vercel → Edge: X-Use60-Timestamp + X-Use60-Signature (signed headers)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { hmacSha256Hex } from '../_shared/signing';

function getHeader(req: VercelRequest, name: string): string | null {
  const v = (req.headers as any)[name.toLowerCase()];
  if (!v) return null;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

async function readRawBody(req: VercelRequest): Promise<string> {
  // If Vercel already provided a parsed body, we may not be able to re-read the stream.
  if (typeof (req as any).body === 'string') return (req as any).body;
  if (Buffer.isBuffer((req as any).body)) return ((req as any).body as Buffer).toString('utf8');

  // Try reading the stream
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  } catch {
    // ignore
  }

  // Last resort: stringify parsed body
  return JSON.stringify((req as any).body ?? {});
}

/**
 * Verify Sentry webhook signature
 * Sentry uses HMAC-SHA256 with format: sentry_sig=<timestamp>,<signature>
 * See: https://docs.sentry.io/product/integrations/integration-platform/webhooks/
 */
function verifySentrySignature(secret: string, rawBody: string, signatureHeader: string): boolean {
  try {
    // Parse signature header - format: "timestamp=<ts>,sentry_sig=<sig>"
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('timestamp='));
    const sigPart = parts.find(p => p.startsWith('sentry_sig='));

    if (!timestampPart || !sigPart) {
      console.error('[sentry-webhook-proxy] Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.replace('timestamp=', '');
    const providedSig = sigPart.replace('sentry_sig=', '');

    // Check timestamp is not too old (5 minute tolerance)
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      console.error('[sentry-webhook-proxy] Signature timestamp too old');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    // Constant-time comparison
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const providedBuf = Buffer.from(providedSig, 'hex');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (error) {
    console.error('[sentry-webhook-proxy] Signature verification error:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Sentry-Hook-Signature, Sentry-Hook-Resource, Sentry-Hook-Timestamp');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Webhooks must use POST.' });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proxySecret = process.env.SENTRY_WEBHOOK_PROXY_SECRET;
    const sentryWebhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
    const orgId = (req.query?.org_id as string | undefined) || (req.query?.orgId as string | undefined);

    if (!supabaseUrl) {
      console.error('[sentry-webhook-proxy] Missing SUPABASE_URL');
      throw new Error('Webhook endpoint not configured');
    }

    if (!supabaseServiceKey) {
      console.error('[sentry-webhook-proxy] Missing SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Webhook endpoint not configured');
    }

    if (!proxySecret) {
      console.error('[sentry-webhook-proxy] Missing SENTRY_WEBHOOK_PROXY_SECRET');
      throw new Error('Webhook endpoint not configured');
    }

    // Read raw body once
    const rawBody = await readRawBody(req);

    // Verify Sentry's webhook signature if secret is configured
    if (sentryWebhookSecret) {
      const sigHeader = getHeader(req, 'sentry-hook-signature');

      if (!sigHeader) {
        console.error('[sentry-webhook-proxy] Missing Sentry-Hook-Signature header');
        return res.status(401).json({ success: false, error: 'Missing webhook signature' });
      }

      if (!verifySentrySignature(sentryWebhookSecret, rawBody, sigHeader)) {
        console.error('[sentry-webhook-proxy] Invalid Sentry webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    // Extract Sentry-specific headers for context
    const sentryResource = getHeader(req, 'sentry-hook-resource') || 'unknown';
    const sentryTimestamp = getHeader(req, 'sentry-hook-timestamp') || '';

    // Create signed payload for Edge Function
    const ts = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `v1:${ts}:${rawBody}`;
    const sig = hmacSha256Hex(proxySecret, signedPayload);

    // Build forward headers
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'X-Use60-Timestamp': ts,
      'X-Use60-Signature': `v1=${sig}`,
      'X-Sentry-Hook-Resource': sentryResource,
      'X-Sentry-Hook-Timestamp': sentryTimestamp,
    };

    // Build Edge Function URL with org_id
    const queryParams = new URLSearchParams();
    if (orgId) queryParams.set('org_id', orgId);

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/sentry-webhook${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    console.log(`[sentry-webhook-proxy] Forwarding ${sentryResource} webhook to Edge Function${orgId ? ` for org ${orgId}` : ''}`);

    // Forward to Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: rawBody,
    });

    const responseText = await response.text();

    // Parse response
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[sentry-webhook-proxy] Edge function error: ${response.status} - ${responseText}`);
      return res.status(response.status).json({
        success: false,
        error: responseData.error || 'Webhook processing failed',
        processingTimeMs: processingTime,
        ...responseData,
      });
    }

    console.log(`[sentry-webhook-proxy] Webhook processed successfully in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      ...responseData,
      proxiedBy: 'use60-sentry-webhook-proxy',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('[sentry-webhook-proxy] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });
  }
}
