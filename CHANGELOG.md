## [1.1.3] - 2026-05-03

61e8fdf Fix/s3 checkum (#8)


---

## [1.1.1] - 2026-05-03
=======
## [1.1.2] - 2026-05-03
>>>>>>> 058124ded43b5e7108955753a8751d5e0fda5cb0

1f610c3 Feature/state videos (#7)

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
- `MinIOAdapter`: internal `S3Client` with `forcePathStyle: true` for multipart operations (the `minio` npm package does not expose multipart APIs publicly)
- Small-file fallback in `UploadService`: files ≤ 10MB skip multipart and use `storage.upload()` directly
- Jest + ts-jest unit test suite (`npm test`)
- 8 unit tests covering `UploadService` multipart logic and edge cases

### Changed

- `POST /api/upload` now accepts `{ filename, size, mimeType }` JSON body (previously received a full `FormData` file upload) and returns `{ sessionId, videoId, chunkSize, totalChunks }`
- `UploadArea.tsx` replaced XHR single-request with a three-phase `fetch` flow: initiate → sequential chunk loop → complete; progress advances per chunk
- `S3Adapter`: implemented `initiateMultipartUpload`, `uploadPart`, `completeMultipartUpload` (previously stubs with `console.log`)
- `UploadSession` type extended with `totalSize`, `filename`, `uploadId`, `etags`
- `uploadedBytes` in `upload.progress` events is now clamped to `totalSize` (previously could exceed file size on the final chunk)

### Removed

- `IStorageAdapter.uploadChunk` — replaced by `uploadPart` with corrected signature
- XHR-based single-request upload from `UploadArea.tsx`
- Temporary chunk files in `MinIOAdapter` (`.chunk.N` objects) — no longer needed with native multipart

### Fixed

- `uploadedBytes` in `upload.progress` events overflowed total file size on the final chunk when file size was not a multiple of chunk size

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
