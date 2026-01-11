import { metrics, trace, type SpanStatusCode } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

type OtelGlobals = {
  meterProvider: MeterProvider;
  tracerProvider: BasicTracerProvider;
  meter: ReturnType<typeof metrics.getMeter>;
  instruments: {
    requestCount: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']>;
    requestDurationMs: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
  };
};

const GLOBAL_KEY = '__use60_otel__';

function parseOtelHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};

  // Spec allows comma-separated key=value pairs.
  // Grafana instructions sometimes show URL-encoded values (e.g. Basic%20...).
  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {};
  for (const entry of entries) {
    const idx = entry.indexOf('=');
    if (idx <= 0) continue;
    const key = entry.slice(0, idx).trim();
    const valueRaw = entry.slice(idx + 1).trim();
    const value = decodeURIComponent(valueRaw.replace(/\+/g, '%20'));
    headers[key] = value;
  }
  return headers;
}

function getOtlpUrls(): { tracesUrl?: string; metricsUrl?: string; headers: Record<string, string> } {
  const endpointRaw = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpoint = endpointRaw ? endpointRaw.replace(/\/$/, '') : '';
  const headers = parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  if (!endpoint) return { headers };

  // Grafana OTLP gateway endpoints usually look like: https://.../otlp
  // OTLP/HTTP exporters expect per-signal paths:
  // - {endpoint}/v1/traces
  // - {endpoint}/v1/metrics
  return {
    tracesUrl: `${endpoint}/v1/traces`,
    metricsUrl: `${endpoint}/v1/metrics`,
    headers,
  };
}

function getResource(): Resource {
  const serviceName = process.env.OTEL_SERVICE_NAME || 'use60-vercel-api';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
  const region = process.env.VERCEL_REGION;

  const attrs: Record<string, string> = {
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env,
  };
  if (region) attrs[SemanticResourceAttributes.CLOUD_REGION] = region;

  return new Resource(attrs);
}

export function getOtel(): OtelGlobals | null {
  const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  if (!hasEndpoint) return null;

  const g = globalThis as any;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY] as OtelGlobals;

  const { tracesUrl, metricsUrl, headers } = getOtlpUrls();
  const resource = getResource();

  // ---- Metrics ----
  const meterProvider = new MeterProvider({ resource });
  if (metricsUrl) {
    const metricExporter = new OTLPMetricExporter({ url: metricsUrl, headers });
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
    });
    meterProvider.addMetricReader(metricReader);
  }
  metrics.setGlobalMeterProvider(meterProvider);
  const meter = metrics.getMeter(resource.attributes[SemanticResourceAttributes.SERVICE_NAME] as string);

  const requestCount = meter.createCounter('http.server.requests', {
    description: 'Count of HTTP requests handled by Vercel API routes',
    unit: '1',
  });

  const requestDurationMs = meter.createHistogram('http.server.duration', {
    description: 'Duration of HTTP requests handled by Vercel API routes',
    unit: 'ms',
  });

  // ---- Traces ----
  const tracerProvider = new BasicTracerProvider({ resource });
  if (tracesUrl) {
    const traceExporter = new OTLPTraceExporter({ url: tracesUrl, headers });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
  }
  tracerProvider.register();

  const otel: OtelGlobals = {
    meterProvider,
    tracerProvider,
    meter,
    instruments: { requestCount, requestDurationMs },
  };

  g[GLOBAL_KEY] = otel;
  return otel;
}

export function getSpanStatusCode(statusCode: number): SpanStatusCode {
  return statusCode >= 500 ? 2 : 1; // 2=ERROR, 1=OK
}

