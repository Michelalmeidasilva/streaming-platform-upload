## [Unreleased] 2026-06-09
### Added
- Read-only Metrics tab and GET /api/runs proxy: transcode runs grouped by machine label with per-codec processing time, CPU, and output bitrate.

## [Unreleased] 2026-06-09
### Added
- Codec and resolution selector in the upload form: operators choose **exactly one** codec (H.264, H.265, or AV1) via a radio group and one or more output resolutions (360p, 480p, 720p, 1080p, checkboxes) before starting an upload.
- `upload.started` event now carries a `transcode` field (`{ codecs: string[], renditions: { width, height, codec }[] }`) with the codec×resolution product (the single selected codec × the selected resolutions), forwarded to the gateway and on to the transcoder.
- Defaults: H.264 + 720p + 1080p. AV1 displays a latency warning in the UI.
- Validation blocks the upload if no resolution is selected (a codec is always selected via the radio).

## [1.5.1] - 2026-06-07
### Fixed
- `isE2EAuthEnabled()` (`src/lib/auth/e2e.ts`) no longer gates on `NODE_ENV`. Next freezes `process.env.NODE_ENV` as `'production'` at build time (in every access form — dot or bracket), so the `NODE_ENV !== 'production'` guard disabled the E2E auth bypass in the optimized Docker image even when it runs locally with `NODE_ENV=development`. The upload API therefore returned `401` for the `e2e-session` cookie and the only remaining provider (Google OAuth) is unusable locally. The gate is now the explicit, runtime-read `E2E_AUTH_ENABLED` flag (off by default; prod must not set it) — consistent with the credentials-provider gate in `auth/config.ts`. Verified live: authenticated upload through the UI/BFF → ingest → transcode → ready → playback in `streaming-web-client`.

2bd735a Fix E2E auth in the production-built Docker image
56e34e3 chore: refresh package-lock (drop stale peer markers)

73de900 docs: record realtime SSE push design, SPEC and changelog
c365dd8 docs: document RABBITMQ_URL in .env.example for BFF realtime consumer
fbb944a feat: drive SSE stream from RabbitMQ hub instead of polling
60be15f feat: add lazy idempotent realtime bootstrap
005f9bf feat: add RabbitConsumer binding video_events to the hub
4fca80b feat: add VideoEventHub for in-process realtime fan-out
b6e4ce0 build: add amqplib for BFF realtime consumer
14c4528 docs: plano de implementacao do push de UI via consumer RabbitMQ
507ccdb docs: spec do push de UI em tempo real via consumer RabbitMQ no BFF
de1deb6 test(upload): cover .mkv non-canonical MIME types + doc extended formats
52663d9 feat(upload): wire NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB build arg
f88657a docs(telemetry): document CloudWatch EMF migration
b190dd3 refactor(telemetry): swap /metrics+OTel for EMF wrapper, drop deps
8b12163 feat(telemetry): add CloudWatch EMF wrapper for route handlers

- Telemetry now emits CloudWatch EMF to stdout (RED per request: `RequestCount`, `RequestLatency`, `ErrorCount`; dimensions `service/route/method`; namespace `VOD/streaming-platform-upload`).
### Removed
- OTel SDK push pipeline (`instrumentation.ts`, `@opentelemetry/*` deps), prom-client metrics registry (`src/lib/metrics.ts`), and the `GET /api/metrics` endpoint + `prom-client` dep.

## [1.4.0] - 2026-06-04

b22a66d Merge remote-tracking branch 'origin/main'
23c5739 chore(env): set example UPLOAD_MAX_FILE_SIZE_GB to 10
7b4c53a Merge feat/upload-status-stages: 6 visible upload stages + configurable max file size
a7a1f19 fix(upload): style stage badges, fix SSE effect dep, drop dead updateVideoStatus
9395133 feat(upload): configurable max file size via UPLOAD_MAX_FILE_SIZE_GB
2804444 docs(upload): document 6 upload stages and deriveUploadStage
92a3cc6 docs(env): document UPLOAD_RAW_PREFIX_ENABLED requirement on AWS
ffe4ddb feat(UploadArea): track server videoId, subscribe SSE, render 6 stages
01cf852 feat(VideoList): render 6 derived upload stages
04f38d0 feat(i18n): add 6 upload stage labels (en/es/pt)
30d14fa feat(stream): propagate storageConfirmedAt over SSE
128e791 refactor(upload): remove autoReadyAfterUpload shortcut so transcoding stages surface
21d2b87 feat: add deriveUploadStage pure function
08baae6 feat(types): add storageConfirmedAt and UploadStage
353b6ea feat: added tsconfig

### Fixed
- `.mkv` uploads were rejected with `400 Unsupported MIME type` even though `.mkv`
  is an accepted extension: the server MIME allow-list only had `video/x-matroska`,
  but browsers report Matroska inconsistently (Safari/iOS sends `video/matroska`
  without the `x-`). Added `.mkv` to `NO_CANONICAL_MIME_EXTENSIONS` in
  `src/app/api/upload/route.ts` so MIME is not strictly enforced for it (the
  extension allow-list remains the gate), matching the existing `.y4m`/`.yuv`
  handling. Added a regression test covering `video/matroska`, `video/x-matroska`,
  `application/octet-stream` and empty MIME.
- Raising `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB` in `.env` had no effect on the
  Docker-built client: the value is inlined at build time, but it was never passed
  as a `build.arg`, so the browser kept enforcing the 5 GB default and rejected
  larger files (e.g. a 7.1 GB upload) with an immediate "file too large" alert —
  even when the server limit was already raised. Added the `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB`
  build arg (`Dockerfile` + `infra/docker-compose.yml`) so the client bundle honors
  the configured limit. Also documented that a running container must be recreated
  (`docker compose up -d --build streaming-platform-upload`) for an `.env` change to
  reach both the server runtime and the client bundle.

### Added
- Six visible upload lifecycle stages (uploading, upload finished, available to
  preview, transcoding pending, transcoding, transcoded) in both the active upload
  card (`UploadArea`) and the library (`VideoList`), derived from `status` +
  `processingStatus` + `storageConfirmedAt` via the pure function `deriveUploadStage`
  (`src/lib/uploadStage.ts`).
- `UploadArea` now captures the server-assigned `videoId` returned by
  `POST /api/upload` (`serverVideoId`) and subscribes to the SSE stream so the
  active card advances through transcoding stages (3–6) in real time.
- `UploadStage` union type in `src/types/index.ts`.
- Stage labels (`stages.*`) for `en`, `es`, and `pt` in
  `src/lib/i18n/translations.ts`.

### Changed
- `storageConfirmedAt` (RFC3339) is now part of the `/api/videos/stream` SSE
  snapshot diff and the emitted `video-updated` payload, enabling stage 3
  (`available`) transitions to be pushed to the browser.
- `Video` type gains the optional `storageConfirmedAt` field, mapped from the
  `streaming-ingest` upload-state document.

### Removed
- The `autoReadyAfterUpload` shortcut (`AUTO_READY_AFTER_UPLOAD_ENABLED`) that
  forced `status=ready` 2 seconds after upload completion and hid the transcoding
  stages. Readiness is now driven by the real transcode completion signal
  (`processingStatus=ready`) delivered via SSE.

## [Unreleased] 2026-06-04
### Added
- Configurable maximum upload size. The previously hardcoded 5GB limit is now
  read from `UPLOAD_MAX_FILE_SIZE_GB` (server) and `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB`
  (client), both defaulting to 5GB; e.g. set both to `10` to allow 10GB uploads.
  Introduced `src/lib/uploadLimits.ts` as the single source of truth (server var
  takes precedence, public var is the client fallback, invalid/zero/negative
  values fall back to 5GB). Wired into `validateCMAFFile` and the upload API.
  The localized "file too large" message now interpolates the configured limit
  (`{{limit}}`) instead of a hardcoded "5GB" across EN/ES/PT.
- Accept additional source formats: `.mkv`, `.y4m` and raw `.yuv` (in addition
  to `.mp4`, `.mov`, `.m4v`, `.webm`, `.m3u8`). Updated the upload API allowlist,
  client-side `validateCMAFFile`, the dropzone `accept` attribute and format
  badges.
- `.y4m`/`.yuv` have no canonical MIME type, so MIME enforcement is skipped for
  them; `video/x-matroska` was added for `.mkv`.

## [1.3.0] - 2026-06-04

17d09e8 feat: accept mkv/y4m/yuv uploads and sidecar .srt subtitles

- Raw `.yuv` uploads collect `rawVideo` geometry (width×height, fps, pixel
  format) from the operator before the upload starts and forward it on the
  `upload.started` event (new `RawVideoParams` type, `emitUploadStarted` /
  `initiateUpload` accept it). The API rejects `.yuv` without valid width/height/fps.
- Sidecar subtitles: `.srt` files dropped alongside a video are paired by
  basename (`movie.srt` / `movie.en.srt` → `movie.mp4`; language inferred from
  the name) and, for a single video, any unmatched `.srt` is attached to it.
  `initiateUpload` presigns a PUT per subtitle (`subtitles/<videoId>/<lang>.srt`),
  returns `subtitleUploads`, and forwards the refs on `upload.started`
  (`SubtitleRef`). The client uploads the `.srt` bytes to the presigned URLs.

## [1.2.5] - 2026-06-04

62b7d06 Merge remote-tracking branch 'origin/main'
e07842b merge fix/upload-area: thumbnail proxy, cache dir, SSE + thumbnail WIP
8774a7d fix(platform): serve thumbnails via same-origin proxy + cache dir
053d078 docs(platform): thumbnail derive + SSE status
789d102 feat(platform): live status/thumbnail updates via SSE in library
17d8dd5 feat(platform): SSE stream of video status changes
b6d402f feat(platform): default thumbnail fallback in library grid
496946e feat(platform): derive public thumbnailUrl from thumbnailStatus

699ec82 chore: migrate docs to obsidian-vault, add AGENTS.md
f81a96a feat(agents): add streaming-platform-upload AGENTS.md
52dc314 chore: fix uploada chunk
706179a chore: fix readme.md
9918170 chore: fix upload
00456d1 fix(upload): parallelize S3 multipart chunks and remove redundant ListParts call
6b4aefc chore: merge main, resolve conflicts and add gitleaks ignore for security docs
2db79b5 Merge branch 'main' of github.com:Michelalmeidasilva/streaming-platform-upload
2fc162f chore: fix readme.md

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

---

## [1.2.3] - 2026-05-06

a9c3dc9 fix(upload): fall back to server upload when S3 CORS blocks localhost (#11)

- `height: 100dvh` replaces `100vh` — prevents layout jump when mobile browser chrome appears/disappears
- iOS auto-zoom on input focus prevented with `font-size: 16px` on search and title inputs

---

## [1.1.3] - 2026-05-03
### Fixed
- S3 direct browser uploads were rejected by AWS with HTTP 400 due to AWS SDK v3 >= 3.500
  injecting `x-amz-checksum-crc32=AAAAAA==` into presigned URLs by default. Fixed by setting
  `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'`
  on the `S3Client` constructor in `S3Adapter`.

---

## [1.1.2] - 2026-05-03
### Added
- New `thumbnailStatus` field on Video model (pending | ready | failed)
- `ThumbnailExtractor` service for FFmpeg integration and thumbnail orchestration
- `FallbackGenerator` for dynamic placeholder image creation
- `sharp` dependency for image generation and processing
- Comprehensive test coverage for thumbnail extraction and fallback generation

### Changed
- `POST /api/upload/complete` response now includes `thumbnailStatus` and `thumbnailUrl` fields
- Video model includes new optional `thumbnailStatus` field

---

## [0.2.0] - 2026-04-26
### Added
- **True multipart upload** via S3/MinIO Multipart Upload protocol (see ADR-0001)
- `POST /api/upload/chunk` — new endpoint to receive individual 10MB file parts
- `POST /api/upload/complete` — new endpoint to finalize a multipart upload
- `src/lib/api/uploadService.ts` — shared singleton module (Next.js App Router forbids arbitrary named exports from route files)
- `UploadSession.uploadId` — stores the upload ID returned by `initiateMultipartUpload`
- `UploadSession.etags` — accumulates `{ PartNumber, ETag }` entries returned by each `uploadPart` call
- `IStorageAdapter.uploadPart(chunk, key, uploadId, partNumber)` — replaces the former stub `uploadChunk`
- `IStorageAdapter.completeMultipartUpload(key, uploadId, parts)` — now accepts the full ETags array
- `MinIOAdapter`: internal `S3Client` with `forcePathStyle: true` for multipart operations
- Small-file fallback in `UploadService`: files ≤ 10MB skip multipart and use `storage.upload()` directly
- Jest + ts-jest unit test suite (`npm test`)
- 8 unit tests covering `UploadService` multipart logic and edge cases

### Changed
- `POST /api/upload` now accepts `{ filename, size, mimeType }` JSON body and returns `{ sessionId, videoId, chunkSize, totalChunks }`
- `UploadArea.tsx` replaced XHR single-request with a three-phase `fetch` flow: initiate → sequential chunk loop → complete
- `S3Adapter`: implemented `initiateMultipartUpload`, `uploadPart`, `completeMultipartUpload`
- `UploadSession` type extended with `totalSize`, `filename`, `uploadId`, `etags`
- `uploadedBytes` in `upload.progress` events is now clamped to `totalSize`

### Removed
- `IStorageAdapter.uploadChunk` — replaced by `uploadPart` with corrected signature
- XHR-based single-request upload from `UploadArea.tsx`
- Temporary chunk files in `MinIOAdapter`

### Fixed
- `uploadedBytes` in `upload.progress` events overflowed total file size on the final chunk

---

## [0.1.0] - 2026-04-25
### Added
- Initial project scaffold with Next.js 14 App Router
- `UploadArea` component with drag-and-drop and file browser
- `VideoList` component
- `IStorageAdapter` interface with `S3Adapter` and `MinIOAdapter` implementations
- `UploadService` with session management
- Event-driven architecture via `VideoEventEmitter`
- Integration layer (`ApiConnector`, `WebhookConnector`, `QueueConnector`, `EventGatewayConnector`)
- Docker Compose setup with MinIO for local development
- CMAF file validation
