## [1.2.1] - 2026-05-05

2c2fd20 fix(upload): parallelize S3 multipart chunks and remove redundant API calls (#10)

- `useE2ESession` shared hook — eliminates duplicated e2e cookie logic from page, UploadArea and VideoList
- Global `:focus-visible` ring for keyboard/switch-access navigation
- `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` on interactive elements
- Keyboard support (Enter/Space) on UploadArea dropzone
- All touch targets enlarged to 44×44px minimum (Apple HIG)
- `modal.downloading` translation key in EN, ES and PT

### Fixed
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
