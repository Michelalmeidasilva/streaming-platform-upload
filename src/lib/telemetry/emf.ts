const SERVICE = 'streaming-platform-upload';

export type EmfInput = { route: string; method: string; status: number; latencyMs: number };
type Sink = (line: string) => void;

const defaultSink: Sink = (line) => process.stdout.write(line + '\n');

/** Emits one CloudWatch EMF record. CloudWatch Logs extracts the metrics; no scrape endpoint. */
export function emitEmf(input: EmfInput, sink: Sink = defaultSink): void {
  const record = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: `VOD/${SERVICE}`,
          Dimensions: [['service', 'route', 'method']],
          Metrics: [
            { Name: 'RequestCount', Unit: 'Count' },
            { Name: 'RequestLatency', Unit: 'Milliseconds' },
            { Name: 'ErrorCount', Unit: 'Count' },
          ],
        },
      ],
    },
    service: SERVICE,
    route: input.route,
    method: input.method,
    RequestCount: 1,
    RequestLatency: input.latencyMs,
    ErrorCount: input.status >= 500 ? 1 : 0,
  };
  sink(JSON.stringify(record));
}

/**
 * Wraps an app-router handler to emit a RED EMF record per request.
 * Drop-in replacement for the old withMetrics(route, handler).
 */
export function withEmf<Req extends Request = Request, Ctx = unknown>(
  route: string,
  handler: (req: Req, ctx?: Ctx) => Promise<Response> | Response,
  sink: Sink = defaultSink,
): (req: Req, ctx?: Ctx) => Promise<Response> {
  return async (req: Req, ctx?: Ctx): Promise<Response> => {
    const start = process.hrtime.bigint();
    let status = 500;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      return res;
    } finally {
      const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
      emitEmf({ route, method: req.method, status, latencyMs }, sink);
    }
  };
}
