import type { VercelRequest, VercelResponse } from '@vercel/node';
// Static imports to trigger Vercel's dependency tracing
import * as otelApi from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  return res.status(200).json({
    ok: true,
    otel: {
      apiLoaded: typeof otelApi.trace === 'object',
      resourceLoaded: typeof Resource === 'function',
      hasEndpoint,
      serviceName,
      environment: env,
    },
    timestamp: new Date().toISOString(),
  });
}
