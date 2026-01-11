import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  // Simple test - no OTEL imports
  return res.status(200).json({
    ok: true,
    message: 'Basic function works',
    config: {
      hasEndpoint,
      serviceName,
      environment: env,
    },
    timestamp: new Date().toISOString(),
  });
}
