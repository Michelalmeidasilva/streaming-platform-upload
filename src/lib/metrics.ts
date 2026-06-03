import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const SERVICE = 'streaming-platform-upload';

type MetricsBundle = {
  registry: Registry;
  httpRequestsTotal: Counter<string>;
  httpRequestDuration: Histogram<string>;
};

const globalForMetrics = globalThis as unknown as { __vodMetrics?: MetricsBundle };

function buildMetrics(): MetricsBundle {
  const registry = new Registry();
  registry.setDefaultLabels({ service: SERVICE });
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by the BFF API',
    labelNames: ['service', 'status_code', 'method', 'path'],
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['service', 'status_code', 'method', 'path'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  return { registry, httpRequestsTotal, httpRequestDuration };
}

/** Returns the singleton metrics bundle, creating it once and caching on globalThis (HMR-safe). */
export function getMetrics(): MetricsBundle {
  if (!globalForMetrics.__vodMetrics) {
    globalForMetrics.__vodMetrics = buildMetrics();
  }
  return globalForMetrics.__vodMetrics;
}

const metrics = getMetrics();

export const { registry, httpRequestsTotal, httpRequestDuration } = metrics;

/**
 * Wraps an app-router route handler to record RED metrics.
 * `path` is the route label (low cardinality).
 *
 * Accepts handlers typed for either `Request` or `NextRequest` (which extends `Request`).
 * The context argument is optional so existing single-arg tests keep working.
 */
export function withMetrics<Req extends Request = Request, Ctx = unknown>(
  path: string,
  handler: (req: Req, ctx?: Ctx) => Promise<Response> | Response,
): (req: Req, ctx?: Ctx) => Promise<Response> {
  return async (req: Req, ctx?: Ctx): Promise<Response> => {
    const start = process.hrtime.bigint();
    const method = req.method;
    let status = 500;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      return res;
    } finally {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { service: SERVICE, status_code: String(status), method, path };
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, seconds);
    }
  };
}
