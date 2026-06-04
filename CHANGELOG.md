# Changelog

## [Unreleased] 2026-06-04
### Added
- Same-origin thumbnail proxy `GET /api/videos/[videoId]/thumbnail`: streams the
  stored thumbnail object (`thumbnails/<id>.jpg`, or `…-fallback.jpg` when
  `thumbnailStatus === 'failed'`) by fetching it server-side through a signed URL
  built against the **internal** storage endpoint (`minio:9000`). Unauthenticated
  by design — the bucket is already public-read and the `next/image` optimizer,
  which fetches the URL server-side, does not forward the user session.

### Changed
- `deriveThumbnailUrl` now returns the same-origin proxy path
  (`/api/videos/<id>/thumbnail`) whenever a thumbnail exists (explicit
  `thumbnailUrl`, or `thumbnailStatus` `ready`/`failed`), instead of the raw
  object-storage URL. It no longer needs the storage adapter argument.

### Fixed
- Thumbnails rendered broken (HTTP 500) when the app runs in Docker. `VideoList`
  uses `next/image`, whose optimizer runs **server-side inside the container** and
  fetched the stored `thumbnailUrl = http://localhost:9000/...` (the browser-facing
  `MINIO_PUBLIC_ENDPOINT`). Inside the container `localhost:9000` is `ECONNREFUSED`
  (MinIO is `minio:9000`), so `/_next/image` returned 500. The new proxy keeps the
  URL same-origin and resolves the object via the internal endpoint, fixing the
  dual-host trap for both the optimizer and direct browser loads.
- Docker runner now creates `/app/.next/cache` and chowns `.next` to the `nextjs`
  runtime user. The `next/image` optimizer could not `mkdir` its cache dir
  (`EACCES`), repeatedly re-optimizing images and spamming errors.

## [Unreleased] 2026-06-03
### Added
- `/api/videos` and `/api/videos/[videoId]` now derive `thumbnailUrl`: uses an
  explicit `thumbnailUrl` field if present, otherwise builds a public unsigned URL
  via `storageAdapter.getPublicUrl('thumbnails/<id>.jpg')` when
  `thumbnailStatus === 'ready'`, otherwise null. Helper extracted to
  `src/app/api/videos/thumbnail.ts`.
- Default image `public/default-thumbnail.png`; `VideoList` renders it as a
  fallback when `thumbnailUrl` is null.
- SSE endpoint `GET /api/videos/stream` (`text/event-stream`, cookie-auth): polls
  the ingest service every 3 s, diffs the video list, and emits
  `event: video-updated` with `{id,status,processingStatus,thumbnailStatus,
  thumbnailUrl}` for each changed video. A 15 s heartbeat keeps the connection
  alive. `VideoList` opens an `EventSource` and merges updates in real time —
  processing→ready badge transitions and thumbnails appear without a page refresh.

### Fixed
- Thumbnails quebravam no browser quando o app roda em container: o `thumbnailUrl`
  era uma presigned URL com host interno do Docker (`http://minio:9000`), que o
  navegador (no host) não resolve — e ainda expirava pelo TTL. Agora o
  `thumbnailUrl` é uma URL pública **não-assinada** montada com o novo
  `MINIO_PUBLIC_ENDPOINT` (padrão `http://localhost:9000`), espelhando o modelo
  `CDN_BASE` do streaming-distribution sobre o bucket public-read.

### Added
- Env var `MINIO_PUBLIC_ENDPOINT` e método `IStorageAdapter.getPublicUrl(key)`
  (MinIO: URL pública path-style não-assinada; S3/Memory: delega ao presigned host
  público). Usado para URLs entregues ao browser (thumbnails).

- Endpoint `GET /api/metrics` expondo métricas Prometheus RED
  (`http_requests_total`, `http_request_duration_seconds`) com labels
  `service,status_code,method,path`. Permite ao streaming-telemetry coletar
  requests/erros/latência (sinais 1/4/5) por scrape.
