import type { VercelRequest, VercelResponse } from '@vercel/node';
import { trace } from '@opentelemetry/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  return res.status(200).json({
    ok: true,
    message: 'OTEL API imported',
    otelApiLoaded: typeof trace === 'object',
    config: {
      hasEndpoint,
      serviceName,
      environment: env,
    },
    timestamp: new Date().toISOString(),
  });
}
