# Transcode Metrics Tab

## Overview

The Metrics tab is a read-only view in the admin upload platform that displays transcode
benchmark results grouped by EC2 machine type. It is intended for operators who want to
compare codec processing performance across different instance types before committing to a
production configuration.

## Production / Benchmark Toggle

The tab has two views selected by a toggle at the top of the `TranscodeMetrics` component:
**Production** (default) and **Benchmark**.

## Production View

Calls `GET /api/runs` (no `benchmark` parameter). Runs are grouped by `machineLabel` (the
EC2 instance type label set via `TRANSCODE_MACHINE_LABEL` on the worker). Within each
group, a per-codec aggregation table is displayed:

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

## Benchmark View

Calls `GET /api/runs?benchmark=true`. Runs are organized **per video**: each source clip
is a distinct block showing the clip title and source characterization
(`{w}×{h} · {duration}s · {codec} · {size}`). Within each video block, every individual
benchmark run is shown as **one row** in a flat table (not an aggregate):

| Column | Description |
|--------|-------------|
| Machine | EC2 instance type label (`machineLabel`) |
| Codec | Codec ID used for this run (e.g. `h264`, `av1`) |
| Resolution | Rendition resolution (e.g. `1280×720`) |
| Run time (s) | Wall-clock encode seconds for this run |
| Output kbps | Measured output bitrate in kbps |
| Output size | Encoded output file size (from `outputFileSizeBytes`) |
| CPU % | Average CPU utilisation during encoding |
| Date | `completedAt` timestamp |
| Rep. | Repetition index within the matrix cell |

The benchmark view is designed for comparing encode performance across EC2 instance types
using data produced by `streaming-transcode cmd/benchmark` over an S3 corpus.

Different instance types appear as rows within the same video block — operators can
compare `c5.xlarge` vs. `c5.2xlarge` vs. `c7g.xlarge` for the same source clip side by
side without switching between groups.

### Per-Video Layout

Each video block is headed by the clip title (filename derived from the S3 key, with the
full key in a tooltip) and the source characterization line:

```
<clip filename>
{sourceWidth}×{sourceHeight} · {sourceDurationSeconds}s · {sourceCodec} · {sourceFileSizeBytes}
```

Fields are read from `sourceWidth`, `sourceHeight`, `sourceDurationSeconds`,
`sourceCodec`, and `sourceFileSizeBytes` on each run document (set by
`streaming-transcode cmd/benchmark` via `ffprobe`; zero/empty when the probe failed).

### Output Size Column

The **Output size** column displays the per-rendition `outputFileSizeBytes` field
(int64, bytes) recorded by the encoder (`RenditionMetrics.OutputFileSizeBytes`). It is
formatted for readability (e.g. `17.0 MB`). This column is present only in the Benchmark
view; the Production view is unchanged.

### Aggregation Key

Each row is an individual run — no aggregation is applied in the Benchmark view. Rows
are keyed by `clip × codec × resolution × machineLabel × repetition`, so results from
different corpus clips, instance types, and repeat runs are all visible independently.

## Read Path

```
Browser
  └── GET /api/runs?machineLabel=<label>&codec=<codec>&benchmark=<true|false>   (streaming-platform-upload BFF)
        └── GET /api/v1/runs?machineLabel=<label>&codec=<codec>&benchmark=<true|false>   (streaming-ingest)
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

The Benchmark view is designed for the `transcode-benchmark-harness` infra module workflow:

1. Upload representative corpus clips to `s3://<bucket>/benchmark/corpus/` once.
2. Enable the harness in `infra/` (`enable_transcode_benchmark_harness=true`) and set
   `benchmark_instance_type` to the first instance type to test (e.g. `c5.xlarge`).
3. Apply (`terraform apply`). The self-terminating EC2 instance runs the `cmd/benchmark`
   binary over the corpus (codec×resolution×clip×repeat matrix) and terminates when done.
4. Open the Metrics tab → **Benchmark** view and observe the runs grouped by `c5.xlarge`.
5. Change `benchmark_instance_type` (e.g. to `c5.2xlarge`) and re-apply. The new EC2 runs
   the same corpus and terminates.
6. Repeat for as many instance types as needed. All runs accumulate in `transcode_runs`
   and are visible side by side in the Benchmark view.
7. Set `enable_transcode_benchmark_harness=false` and re-apply to clean up.

See `infra/docs/transcode-benchmark-harness.md` for the full infrastructure workflow.

## Caveats

- The Benchmark view aggregates all cells in `transcode_runs` where `benchmark=true` for
  each machine label. Runs from different corpus sizes or different matrix configurations
  are all included — use consistent `BENCHMARK_CODECS`/`BENCHMARK_RESOLUTIONS` across
  runs for a fair comparison.
- The default benchmark EC2 is `x86_64` (`c5.xlarge`). Benchmarking Graviton (`arm64`)
  instances requires an arm64-capable ECR image build
  (`make -C streaming-transcode image-push-multiarch`) and setting `benchmark_ami_arch=arm64`
  in `terraform.tfvars`.
