import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withOtel } from '../_shared/withOtel';

async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  return res.status(200).json({
    ok: true,
    otel: {
      enabled: hasEndpoint,
      serviceName,
      environment: env,
      endpoint: hasEndpoint ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}

export default withOtel('otel-test', handler);
