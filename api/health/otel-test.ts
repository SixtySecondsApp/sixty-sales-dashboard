import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  // Test if we can import OTEL without crashing
  let otelStatus = 'not-tested';
  try {
    const { getOtel } = await import('../lib/otel');
    const otel = getOtel();
    otelStatus = otel ? 'initialized' : 'disabled (no endpoint)';
  } catch (err: any) {
    otelStatus = `error: ${err.message}`;
  }

  return res.status(200).json({
    ok: true,
    otel: {
      status: otelStatus,
      enabled: hasEndpoint,
      serviceName,
      environment: env,
      endpoint: hasEndpoint ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}
