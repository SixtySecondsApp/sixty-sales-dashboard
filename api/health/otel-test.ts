import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const serviceName = process.env.OTEL_SERVICE_NAME || 'not-set';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  const tests: Record<string, string> = {};

  // Test 1: Can we import @opentelemetry/api?
  try {
    const api = await import('@opentelemetry/api');
    tests.api = `ok (version check: ${typeof api.trace})`;
  } catch (err: any) {
    tests.api = `error: ${err.message}`;
  }

  // Test 2: Can we import @opentelemetry/resources?
  try {
    const resources = await import('@opentelemetry/resources');
    tests.resources = `ok (Resource: ${typeof resources.Resource})`;
  } catch (err: any) {
    tests.resources = `error: ${err.message}`;
  }

  // Test 3: Can we import @opentelemetry/sdk-trace-node?
  try {
    const trace = await import('@opentelemetry/sdk-trace-node');
    tests.sdkTraceNode = `ok (BasicTracerProvider: ${typeof trace.BasicTracerProvider})`;
  } catch (err: any) {
    tests.sdkTraceNode = `error: ${err.message}`;
  }

  return res.status(200).json({
    ok: true,
    env: {
      hasEndpoint,
      serviceName,
      environment: env,
    },
    tests,
    timestamp: new Date().toISOString(),
  });
}
