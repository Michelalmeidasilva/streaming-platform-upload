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
