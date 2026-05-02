# ADR-0001: S3 Native Multipart Upload Protocol

**Date:** 2026-04-26
**Status:** Accepted

---

## Context

The original upload implementation sent the entire video file as a single HTTP request (`FormData` with the full file body). For the target file sizes (300MB–1GB), this caused:

- **Timeouts** on slow connections — a single large request has no granular retry
- **Memory pressure** — the entire file was loaded into the server's buffer before being written to storage
- **No real progress** — the progress bar only reflected network transfer to the Next.js server, not actual storage progress
- **False chunking** — `UploadService` had a `CHUNK_SIZE` constant and an `uploadChunk` method that were never called correctly; the route called `uploadChunk(session, 0, fullFileBuffer)`, treating the whole file as "chunk 0"

Three assembly strategies were evaluated:

| | A — composeObject (MinIO) | **B — S3 Multipart (chosen)** | C — Server buffer |
|---|---|---|---|
| Works with S3 production | No | **Yes** | Yes |
| Retry at chunk level | Yes | **Yes** | No |
| Server memory per upload | Low | **Low** | High (full file) |
| Standard protocol | No | **Yes** | No |

## Decision

Implement true S3 Multipart Upload protocol end-to-end:

1. **Frontend** splits files into 10MB chunks via `File.slice()` and calls three endpoints in sequence.
2. **Backend** exposes three dedicated routes: `POST /api/upload` (initiate), `POST /api/upload/chunk` (per part), `POST /api/upload/complete` (finalize).
3. **UploadService** stores `uploadId` and accumulated `ETags` per session (in-memory `Map`).
4. **S3Adapter** uses `CreateMultipartUploadCommand`, `UploadPartCommand`, `CompleteMultipartUploadCommand` from `@aws-sdk/client-s3`.
5. **MinIOAdapter** uses an internal `S3Client` (from `@aws-sdk/client-s3`) configured with `forcePathStyle: true` — the `minio` npm package does not expose multipart upload APIs publicly, but MinIO is fully S3-compatible at the protocol level.

**Small-file fallback:** Files ≤ 10MB (`totalChunks === 1`) bypass multipart entirely and use `storage.upload()` (a single `PutObject`). This is required because S3 mandates a minimum part size of 5MB for all parts except the last.

## Consequences

**Positive:**
- Upload is resumable at the chunk level — a failed chunk can be retried without restarting
- Server memory footprint per upload is bounded to one 10MB chunk buffer at a time
- Progress advances per chunk, giving accurate real-time feedback
- Works identically against real S3 and local MinIO
- `IStorageAdapter` interface is now complete and correct

**Negative:**
- Session state (sessions `Map`, videos `Map`) lives in Next.js server process memory. A server restart during an in-progress upload loses all sessions — multipart uploads started before the restart become orphaned in S3/MinIO. S3 lifecycle rules can clean these up, but this is a known limitation for the MVP.
- Three HTTP round-trips per upload (initiate + N chunks + complete) vs. one previously. For small files this is mitigated by the single-chunk fallback.

**Deferred:**
- Parallel chunk uploads (currently sequential) — straightforward to add, not needed for MVP
- Persistent session storage (database or Redis) — needed before horizontal scaling
- Upload abort/cancel endpoint to clean up orphaned multipart uploads proactively
