import { trace } from '@opentelemetry/api';
import { getOtel, getSpanStatusCode } from './otel';

export type VercelApiHandler = (req: any, res: any) => Promise<any> | any;

function safePath(url: string | undefined): string {
  if (!url) return '';
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
}

export function withOtel(routeName: string, handler: VercelApiHandler): VercelApiHandler {
  return async function otelWrappedHandler(req: any, res: any) {
    const otel = getOtel();
    const start = Date.now();
    const method = String(req?.method || 'UNKNOWN').toUpperCase();
    const path = safePath(String(req?.url || ''));

    if (!otel) {
      return await handler(req, res);
    }

    const tracer = trace.getTracer('use60-vercel-api');
    const span = tracer.startSpan(`api ${method} ${path || routeName}`, {
      attributes: {
        'service.namespace': 'use60',
        'http.method': method,
        'http.target': String(req?.url || ''),
        'http.route': path || routeName,
        'use60.route_name': routeName,
      },
    });

    let unhandledError: unknown = null;
    try {
      return await handler(req, res);
    } catch (err) {
      unhandledError = err;
      span.recordException(err as any);
      throw err;
    } finally {
      const durationMs = Date.now() - start;
      const statusCode = unhandledError ? 500 : Number(res?.statusCode || 200);

      const attrs: Record<string, string | number> = {
        method,
        route: path || routeName,
        route_name: routeName,
        status_code: statusCode,
        vercel_env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      };
      if (process.env.VERCEL_REGION) attrs.vercel_region = process.env.VERCEL_REGION;

      otel.instruments.requestCount.add(1, attrs);
      otel.instruments.requestDurationMs.record(durationMs, attrs);

      span.setAttribute('http.status_code', statusCode);
      span.setStatus({ code: getSpanStatusCode(statusCode) });
      span.end();

      // Ensure we ship telemetry even in short-lived serverless invocations.
      // Keep this lightweight: flush with best-effort and short timeout.
      try {
        await Promise.race([
          Promise.all([otel.tracerProvider.forceFlush(), otel.meterProvider.forceFlush()]),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      } catch {
        // ignore
      }
    }
  };
}

