# Distribution load-test table

## Motivation

The `streaming-distribution` service is the hot path for manifest delivery to every viewer.
Knowing how it performs under load (startup latency, rebuffer ratio, bitrate achieved) before
a live event lets the team decide whether to scale out, switch CDN tiers, or tune cache TTLs.

This feature exposes the data collected by `scalestore` — the distribution load-test runner —
directly inside the Upload platform UI so engineers have a single dashboard.

## Data flow

```
scalestore (Postgres DB)
        │
        └── scalestore-api  :8090
                │  GET /runs        → per-run QoE (player engine × tier)
                │  GET /projections → cloud capacity projections
                │
        /api/distribution-runs  (Next.js proxy route)
                │  - Requires authenticated session (canSearchVideos gate)
                │  - Fetches both endpoints in parallel via Promise.all
                │  - Returns { runs, projections }
                │
        DistributionMetrics component  (client, useEffect)
                │  - Runs table: one row per run × player engine (gpac / shaka)
                │  - Projections table: egress, RPS, connections, cost, saturation tier
```

## Environment variable

| Variable | Default | Description |
|---|---|---|
| `SCALESTORE_API_URL` | `http://localhost:8090` | Base URL of the scalestore HTTP API. Trailing slash is stripped automatically. |

Set this in `.env.local` (dev) or as a container environment variable in production.

## API contract

### `GET /api/distribution-runs`

**Auth:** session required; `canSearchVideos` role check (ADMIN or MEMBER).

**Response `200`:**
```json
{
  "runs": [
    {
      "id": 2,
      "tier": "T1",
      "n_viewers": 2,
      "protocol": "hls",
      "machine": "local",
      "asset_id": "a",
      "started_at": "2026-06-13T11:40:34-03:00",
      "qoe": [
        {
          "RunID": 2,
          "PlayerEngine": "gpac",
          "Samples": 1,
          "StartupP50MS": 100,
          "StartupP95MS": 100,
          "RebufferRatioAvg": 0,
          "BitrateAvgKbps": 2800
        }
      ]
    }
  ],
  "projections": [
    {
      "basis": "T1=1",
      "n_target": 1000000,
      "egress_gb_h": 1260000,
      "agg_rps": 100000,
      "connections": 5000,
      "cost_usd_month": 78347712,
      "saturation_tier": "lambda"
    }
  ]
}
```

**Errors:** `401` (no session), `403` (insufficient role), `502` (scalestore unreachable).

## Caveats

- **Empty until real runs exist:** The table shows an empty state until T1/T2 load-test runs
  have been recorded in the scalestore Postgres DB.
- **QoE fallback rows:** If a run has no `qoe` entries, the table still shows the run with
  `—` in the engine/startup/rebuffer/bitrate/samples columns.
- **Projections section hidden when empty:** The projections card only renders when the
  `projections` array is non-empty.
- **Go field name casing:** The `qoe` array uses Go exported field names (`RunID`,
  `PlayerEngine`, `StartupP50MS`, etc.) — these match the JSON serialised by the Go backend
  without `json` struct tags.
