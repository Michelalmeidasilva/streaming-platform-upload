# Benchmarks Storage Tab

## Motivation

The storebench benchmark compares catalog datastore backends (MongoDB, PostgreSQL, Redis,
and cache-aside combinations) serving `streaming-distribution`'s `GET /catalog`. Results
were previously only available as static HTML or markdown reports generated on demand.
The "Benchmarks Storage" tab surfaces those durable results directly in the admin upload
UI so the team can inspect benchmark data alongside upload and transcode metrics, without
leaving the application.

## Proxy Contract

### `GET /api/storebench-runs`

**Auth:** requires an active session (`401` when unauthenticated). The session role must
satisfy `canSearchVideos(role)` (`403` otherwise). This is the same role check used by
`GET /api/runs` and `GET /api/distribution-runs`.

**Upstream:** the route reads `STOREBENCHSTORE_API_URL` (default `http://localhost:8091`)
and fans out **in parallel** to two sub-endpoints:

| Sub-endpoint | Purpose |
|---|---|
| `GET {STOREBENCHSTORE_API_URL}/http-runs` | HTTP end-to-end benchmark records |
| `GET {STOREBENCHSTORE_API_URL}/bench-runs` | Go micro-benchmark records |

**Response `200`:**
```json
{
  "httpRuns":  [ /* HTTP end-to-end run records */ ],
  "benchRuns": [ /* Go micro-benchmark run records */ ]
}
```

**Error semantics:**
- `401` — no session
- `403` — session present but insufficient role
- `502` — either upstream call failed or returned a non-2xx status

The route mirrors `GET /api/distribution-runs` in structure and error handling.

## UI

### `StorebenchMetrics` component (`src/components/StorebenchMetrics.tsx`)

A client component that fetches `GET /api/storebench-runs` on mount and toggles between
two sub-views:

**HTTP (end-to-end) sub-view**

A matrix where:
- **Rows** = benchmark configuration (e.g. backend type + concurrency settings)
- **Columns** = request-rate level (N)
- **Cell values** = req/s achieved and p95 latency

Designed for comparing throughput and tail latency across datastore backends under
increasing load.

**Micro-benchmarks sub-view**

Results grouped by Go benchmark suite. Each suite renders a table with columns:
- **ns/op** — nanoseconds per operation
- **B/op** — heap bytes allocated per operation
- **allocs/op** — heap allocation count per operation

Designed for comparing low-level read path efficiency across storage adapters.

Both sub-views render **loading**, **error**, and **empty** states. No mutations are
possible from either view.

### Sidebar placement

The tab appears as "Benchmarks Storage" in both the desktop sidebar and the mobile
navigation, wired in `src/app/page.tsx` alongside the existing "Metrics" tab.

**i18n keys** (defined in `src/lib/i18n/translations.ts` for `en`, `es`, and `pt-BR`):
- `app.sidebar.storageBench` — sidebar/nav label
- `storageBench.*` — all component-internal labels (sub-view toggle, column headers,
  empty/error/loading messages)

## Running End-to-End Locally

1. **Set up the storebench store** (in the `streaming-distribution` repo):
   ```bash
   # Provision the datastore(s) and schema
   bash bench/storebench/store/setup.sh

   # Run the benchmark to generate results
   # (see streaming-distribution bench docs for flags)

   # Ingest results into the store API's database
   bash bench/storebench/ingest.sh
   ```

2. **Start the storebench store API:**
   ```bash
   STOREBENCHSTORE_API_ADDR=:8091 go run ./cmd/storebenchstore-api
   ```

3. **Configure the upload app** (only needed if the API is not on the default port):
   ```bash
   # In streaming-platform-upload/.env.local (or environment):
   STOREBENCHSTORE_API_URL=http://localhost:8091
   ```

4. **Start the upload app** and open the "Benchmarks Storage" tab in the sidebar.

## Caveats

- The tab requires the `storebenchstore-api` to be running and reachable at
  `STOREBENCHSTORE_API_URL`. If the API is down or returns errors, the component
  renders the error state.
- If no benchmark runs have been ingested yet, the component renders the empty state
  for the relevant sub-view(s).
- The proxy fetches both sub-endpoints in parallel; if either fails, the route returns
  `502`. The Go API must be brought up before visiting the tab.
