# streaming-platform-upload — SPEC

Admin upload UI + BFF (pipeline stage 1). Port 3000. Next.js 14 + TypeScript.
Accepts video files from the operator, drives multipart upload to object storage,
emits lifecycle events to `streaming-ingest`, and shows real-time processing status.

## Endpoints

### POST /api/upload
Initiate a multipart upload session.

Request:
```json
{
  "filename": "movie.mp4",
  "size": 123456789,
  "mimeType": "video/mp4",
  "subtitles": [{ "language": "en", "label": "EN" }]
}
```

Response `200`:
```json
{
  "sessionId": "<uuid>",
  "videoId": "<uuid>",
  "chunkSize": 10485760,
  "totalChunks": 12,
  "subtitleUploads": [
    { "objectKey": "subtitles/<videoId>/en.srt", "url": "https://…", "language": "en", "label": "EN" }
  ]
}
```

Files ≤ 10 MB skip multipart and use a single `PutObject`. The `videoId` is the
server-assigned identifier used for SSE correlation (see Upload stages below).

### POST /api/upload/chunk
Upload one part of an in-progress multipart session.

Request: `multipart/form-data` with fields `sessionId`, `chunkIndex`, `chunk` (binary).

Response `200`: `{ "etag": "<etag>" }`

### POST /api/upload/complete
Finalize a multipart upload and trigger post-upload actions (thumbnail extraction,
`upload.completed` event to the gateway).

Request: `{ "sessionId": "<uuid>" }`

Response `200`: `{ "videoId": "<uuid>", "thumbnailStatus": "pending|ready|failed", "thumbnailUrl": "<url|null>" }`

### GET /api/videos
Fetches the video list from `streaming-ingest` (`INGEST_PERSISTENCE_BASE_URL`).
Returns an array of `Video` objects.

### GET /api/videos/stream
Server-Sent Events stream of video status changes.

```
Content-Type: text/event-stream
Cache-Control: no-cache
```

On connection the current video list is snapshotted. Every **3 seconds** the list
is re-fetched and diffed; any video whose `status`, `processingStatus`,
`thumbnailStatus`, or `storageConfirmedAt` changed emits:

```
event: video-updated
data: {"id":"<id>","status":"<s>","processingStatus":"<ps>","thumbnailStatus":"<ts>","thumbnailUrl":"<url|null>","storageConfirmedAt":"<rfc3339|null>"}
```

A heartbeat comment (`: heartbeat`) is emitted every 15 seconds to keep the
connection alive through proxies. The stream closes when the client disconnects.

### GET /api/videos/[videoId]/thumbnail
Same-origin proxy: fetches the stored thumbnail (`thumbnails/<id>.jpg` or the
fallback) via an internal signed URL and streams it to the browser. Prevents the
`next/image` optimizer from fetching localhost inside the container.

## Upload Stages

Six user-facing upload stages are derived (not persisted) by the pure function
`deriveUploadStage(video)` in `src/lib/uploadStage.ts`. Because lifecycle signals
accumulate over time, the function evaluates conditions most-advanced-first:

| # | Stage key | Label | Condition |
|---|---|---|---|
| — | `error` | Error | `status === 'error'` OR `processingStatus === 'failed'` |
| 6 | `transcoded` | Ready | `processingStatus === 'ready'` OR `status === 'ready'` |
| 5 | `transcoding` | Transcoding | `processingStatus` is `transcoding` or `packaging` |
| 4 | `transcode_pending` | Available · transcoding pending | `processingStatus === 'queued'` |
| 3 | `available` | Available to preview | `storageConfirmedAt` present |
| 2 | `uploaded` | Upload finished | `status === 'processing'` |
| 1 | `uploading` | Uploading | default |

The `error` stage short-circuits the ordered list and can occur at any point.
`deriveUploadStage` is pure and unit-tested.

**Where stages render:**

- `VideoList` — derives a stage per video and renders the `t('stages.<stage>')`
  label. Merges `video-updated` SSE payloads (including `storageConfirmedAt`)
  into the local list in place, advancing the stage badge without a full refetch.
- `UploadArea` — captures the `videoId` returned by `POST /api/upload`
  (`serverVideoId`) and subscribes to the SSE stream. While an upload card is
  active, incoming `video-updated` events are correlated by `serverVideoId` to
  advance the card through stages 3–6 (available → transcoding → transcoded).

Stage labels are i18n-keyed under `stages.*` in `src/lib/i18n/translations.ts`
for `en`, `es`, and `pt`.

## Data Models

### Video

```typescript
interface Video {
  id: string
  videoId: string
  filename: string
  size: number
  status: string            // e.g. 'processing' | 'ready' | 'error'
  processingStatus?: string // 'queued' | 'transcoding' | 'packaging' | 'ready' | 'failed'
  thumbnailStatus?: string  // 'pending' | 'ready' | 'failed'
  thumbnailUrl?: string | null
  storageConfirmedAt?: string | null  // RFC3339; set when the storage ObjectCreated webhook is processed
  createdAt: string
}
```

`storageConfirmedAt` is mapped from the `streaming-ingest` upload-state document
field of the same name and is propagated over the SSE stream to trigger stage 3
(`available`) transitions in the UI.

### UploadStage

```typescript
type UploadStage =
  | 'uploading'
  | 'uploaded'
  | 'available'
  | 'transcode_pending'
  | 'transcoding'
  | 'transcoded'
  | 'error'
```

## Storage Adapters

`src/lib/storage/IStorageAdapter` is the shared interface. Two implementations:

- **`S3Adapter`** — AWS S3 (production). Set `STORAGE_PROVIDER=s3`.
- **`MinIOAdapter`** — local MinIO. Uses an internal `S3Client` with
  `forcePathStyle: true` because the `minio` npm package does not expose multipart
  APIs. Set `STORAGE_PROVIDER=minio`.

Object key convention: `<videoId>/<filename>` (MinIO/local) or
`raw/<videoId>/<filename>` (AWS, when `UPLOAD_RAW_PREFIX_ENABLED=true`).

## Integration Layer

`src/lib/integration/` provides swappable notification backends behind
`IIntegrationConnector`. Implementations: `EventGatewayConnector`,
`WebhookConnector`, `QueueConnector`, `ApiConnector`.

The `EventGatewayConnector` posts lifecycle events (`upload.started`,
`upload.progress`, `upload.completed`) to `EVENT_GATEWAY_URL`.

## Telemetry (CloudWatch EMF)

Per-request telemetry is emitted to stdout as CloudWatch Embedded Metric Format (EMF).
Route handlers are wrapped with `withEmf(route, handler)` (exported from
`src/lib/telemetry/emf.ts`), which measures duration and writes one JSON line per
request with RED metrics (`RequestCount`, `RequestLatency` ms, `ErrorCount`) under
namespace `VOD/streaming-platform-upload`, dimensions `service/route/method`.
`GET /api/metrics` has been removed. See `docs/cloudwatch-emf-telemetry.md`.

## Accepted Formats

`.mp4`, `.m4v`, `.mov`, `.m3u8`, `.webm`, `.mkv`, `.y4m`, `.yuv`. Maximum size
configurable via `UPLOAD_MAX_FILE_SIZE_GB` (default 5 GB). MIME enforcement is
skipped for `.y4m`/`.yuv` (headerless raw, no canonical MIME) and `.mkv`
(browsers report Matroska inconsistently — e.g. Safari sends `video/matroska`
without the `x-`); for these the extension allow-list is the gate.

## Env

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `minio` | `s3` or `minio` |
| `STORAGE_BUCKET` | `videos` | Bucket name |
| `MINIO_ENDPOINT` | `http://localhost:9000` | Internal MinIO endpoint |
| `MINIO_PUBLIC_ENDPOINT` | `MINIO_ENDPOINT` | Browser-facing base URL for object URLs |
| `MINIO_ACCESS_KEY` | `admin` | MinIO access key |
| `MINIO_SECRET_KEY` | `password123` | MinIO secret key |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `EVENT_GATEWAY_URL` | `http://localhost:8080/api/v1` | Event gateway base URL |
| `INGEST_PERSISTENCE_BASE_URL` | `http://localhost:8080/api/v1` | Ingest HTTP base for video list reads |
| `UPLOAD_MAX_FILE_SIZE_GB` | `5` | Server-side max upload size in GB |
| `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB` | `5` | Client-side max upload size in GB. **Inlined into the client bundle at build time** — under Docker it must be passed as a `build.arg` (see `Dockerfile`/`infra/docker-compose.yml`); setting it only via `env_file` raises the server limit but leaves the browser validation at the build-time value. |
| `UPLOAD_CHUNK_SIZE_BYTES` | `5242880` | Multipart chunk size |
| `UPLOAD_RAW_PREFIX_ENABLED` | `false` | **Set `true` on AWS.** Prepends `raw/` to object keys so they match the EventBridge `raw/` notification filter that routes `ObjectCreated` events to `streaming-ingest`. Required for stage 3 (`available`) and the S3→Batch transcode trigger. |
| `NEXTAUTH_SECRET` | `development-secret` | NextAuth JWT secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `ADMIN_EMAILS` | `admin@example.com` | Comma-separated admin emails |
| `NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED` | `false` | Enable direct browser-to-S3 upload |
