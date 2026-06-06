# CloudWatch EMF Telemetry

## Motivation

The production target for `streaming-platform-upload` is AWS Lambda (via Next.js on
Lambda adapters) or ECS Fargate, where pull-based scrape endpoints are invalid: there is
no persistent process to scrape and no Prometheus-compatible collector running alongside
the function. The previous pipeline — `prom-client` driving `GET /api/metrics`, the
`withMetrics()` route wrapper, and the `@opentelemetry/*` SDK in `instrumentation.ts` —
was dead weight once the collector was removed. Stdout is the only reliable,
zero-infrastructure output channel for both Lambda and local development.

## What Changed

- **Removed:** `instrumentation.ts` (OTel SDK bootstrap), `src/lib/metrics.ts` (prom-client
  registry and histogram), the `GET /api/metrics` route, and the `prom-client` +
  `@opentelemetry/*` npm dependencies.
- **Added:** `src/lib/telemetry/emf.ts` — exports `withEmf(route, handler)`, a drop-in
  replacement for the old `withMetrics()` wrapper. It wraps a Next.js App Router route
  handler, measures request duration, and writes one EMF JSON line to stdout per request
  with RED metrics (`RequestCount`, `RequestLatency`, `ErrorCount`) under namespace
  `VOD/streaming-platform-upload`.

## EMF Contract

Each completed HTTP request produces a single line written to stdout:

```json
{
  "_aws": {
    "Timestamp": 1717689600000,
    "CloudWatchMetrics": [{
      "Namespace": "VOD/streaming-platform-upload",
      "Dimensions": [["service","route","method"]],
      "Metrics": [
        {"Name":"RequestCount","Unit":"Count"},
        {"Name":"RequestLatency","Unit":"Milliseconds"},
        {"Name":"ErrorCount","Unit":"Count"}
      ]
    }]
  },
  "service": "streaming-platform-upload",
  "route": "/api/upload",
  "method": "POST",
  "RequestCount": 1,
  "RequestLatency": 88.3,
  "ErrorCount": 0
}
```

`ErrorCount` is `1` when the response status code is `>= 500`, otherwise `0`.

## Dev / Prod Data Flow

The same EMF JSON is emitted to stdout in both environments; in production, CloudWatch
Logs Agent (Lambda built-in, or the ECS log driver) captures stdout, and CloudWatch Logs
automatically extracts the embedded metrics into the `VOD/streaming-platform-upload`
namespace — no collector, no sidecar. Local wiring (LocalStack + log group) is covered
by Plan 2 of the observability migration (infra work, not in scope here).

## Reference

Design spec: `infra/docs/design-docs/specs/2026-06-06-cloudwatch-observability-migration-design.md`
