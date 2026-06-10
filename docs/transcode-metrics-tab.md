# Transcode Metrics Tab

## Overview

The Metrics tab is a read-only view in the admin upload platform that displays transcode
benchmark results grouped by EC2 machine type. It is intended for operators who want to
compare codec processing performance across different instance types before committing to a
production configuration.

## What the Tab Shows

Runs are grouped by `machineLabel` (the EC2 instance type label set via `TRANSCODE_MACHINE_LABEL`
on the worker). Within each group, a per-codec aggregation table is displayed:

| Column | Description |
|--------|-------------|
| Codec | Codec ID (e.g. `h264`, `av1`) |
| Avg elapsed (s) | Average wall-clock seconds across all renditions for that codec |
| Avg CPU % | Average CPU utilisation during ffmpeg encoding |
| Max CPU % | Peak CPU utilisation |
| Avg output bitrate (kbps) | Average measured output bitrate across renditions |
| Preset | ffmpeg preset (e.g. `fast`, `medium`) |
| Runs | Number of run documents included in the aggregate |

No mutations are possible from the Metrics tab — it is strictly a read surface.

## Read Path

```
Browser
  └── GET /api/runs?machineLabel=<label>&codec=<codec>   (streaming-platform-upload BFF)
        └── GET /api/v1/runs?machineLabel=<label>&codec=<codec>   (streaming-ingest)
              └── MongoDB transcode_runs collection
```

The BFF route `src/app/api/runs/route.ts` is auth-gated with the same middleware as
`GET /api/videos` (401 if unauthenticated, 403 if not admin). It forwards `machineLabel` and
`codec` query params to ingest and returns the response verbatim. Upstream failures return 502.

The `TranscodeMetrics` component (`src/components/TranscodeMetrics.tsx`) fetches from
`/api/runs` on mount, groups results by `machineLabel`, computes per-codec aggregates
client-side, and renders the comparison tables.

## Navigation

The Metrics tab appears as a top-level entry in:
- The sidebar navigation (desktop)
- The mobile bottom nav

Navigation between the library/upload view and the Metrics tab is a client-side view toggle
in `app/page.tsx` — no route change, no full page reload.

## i18n

All strings in the Metrics tab are i18n-keyed. Keys are defined in
`src/lib/i18n/translations.ts` for `en`, `es`, and `pt`.

## Benchmark Workflow

The Metrics tab is designed around a specific manual benchmarking workflow:

1. Enable the EC2 benchmark module in `infra/` (`enable_transcode_benchmark=true`) and set
   `benchmark_instance_type` to the first instance type to test (e.g. `c5.xlarge`).
2. Apply the Terraform module (`terraform apply`). The EC2 instance starts the transcode worker
   with `TRANSCODE_MACHINE_LABEL` set to the instance type.
3. Upload **one video** through the normal upload UI. Wait for the transcode to complete (the
   video reaches the "Transcoded / Ready" stage).
4. Open the Metrics tab and observe the run for `c5.xlarge`.
5. Change `benchmark_instance_type` in `terraform.tfvars` (e.g. to `c5.2xlarge`), re-apply,
   upload another video, and observe the new run.
6. Repeat for as many instance types as needed. All runs accumulate in the `transcode_runs`
   collection and are visible side by side in the Metrics tab.

## Caveats

- Each benchmark run corresponds to a single video upload. Use the same source file across
  runs to keep the comparison fair.
- The default benchmark EC2 is `x86_64` (`c5.xlarge`). Benchmarking Graviton (`arm64`) instances
  requires an `arm64` ECR image build first (see `infra/docs/transcode-ec2-benchmark.md`).
- The Metrics tab aggregates all runs in the database for each machine label. If the same
  instance type processed multiple different source files, the aggregated numbers reflect the
  mix — not a single canonical file.
