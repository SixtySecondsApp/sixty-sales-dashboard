import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health check endpoint for OTEL configuration.
 *
 * Note: Vercel's serverless bundler cannot bundle @opentelemetry packages.
 * Instead, use Vercel's built-in OTEL integration configured via dashboard:
 *
 * Vercel Dashboard → Project → Settings → Observability → OTLP Exporter
 * - Endpoint: https://otlp-gateway-prod-gb-south-1.grafana.net/otlp
 * - Headers: Authorization=Basic <base64-encoded-credentials>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  return res.status(200).json({
    ok: true,
    message: 'Vercel native OTEL - configured via dashboard',
    note: '@opentelemetry packages cannot be bundled by Vercel. Use Vercel built-in OTEL instead.',
    config: {
      hasEndpoint,
      serviceName,
      environment: env,
    },
    vercelOtelDocs: 'https://vercel.com/docs/observability/otel-overview',
    timestamp: new Date().toISOString(),
  });
}
