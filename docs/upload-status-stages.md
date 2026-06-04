# Upload Status Stages

## Motivation

Before this feature the upload card showed a binary state: uploading or done. The
transcoding pipeline has four distinct stages after the upload finishes (queued,
transcoding, packaging, ready), and the operator had no visibility into them. A
synthetic `autoReadyAfterUpload` shortcut hid the issue by marking videos ready
2 s after the upload completed, bypassing the real pipeline state entirely.

This feature removes that shortcut and surfaces 6 ordered, user-facing stages in
both the active upload card (`UploadArea`) and the video library (`VideoList`).

---

## The 6 Stages

Stages are ordered from least to most advanced in the pipeline:

| # | Stage key | Label (en) | Meaning |
|---|---|---|---|
| 1 | `uploading` | Uploading | Upload in progress (default) |
| 2 | `uploaded` | Upload finished | File received by the platform (`status === 'processing'`) |
| 3 | `available` | Available to preview | Object stored; `storageConfirmedAt` set by the ingest webhook |
| 4 | `transcode_pending` | Available · transcoding pending | Transcode job queued (`processingStatus === 'queued'`) |
| 5 | `transcoding` | Transcoding | Active FFmpeg/packaging run (`processingStatus` is `transcoding` or `packaging`) |
| 6 | `transcoded` | Ready | Pipeline complete (`processingStatus === 'ready'` OR `status === 'ready'`) |
| — | `error` | Error | Any failure (`status === 'error'` OR `processingStatus === 'failed'`) |

`error` short-circuits the ordered list and can surface at any stage.

---

## `deriveUploadStage` Precedence Rationale

`deriveUploadStage(video: Video): UploadStage` lives in `src/lib/uploadStage.ts`.

Lifecycle signals **accumulate** — once `storageConfirmedAt` is set it stays set,
even after `processingStatus` advances to `transcoding`. If the function checked
`available` (stage 3) before `transcoding` (stage 5), a video in active
transcoding would regress to "available". To prevent this, checks run
**most-advanced-first**: `error` → `transcoded` → `transcoding` →
`transcode_pending` → `available` → `uploaded` → `uploading`.

The function is pure (no side effects, no I/O) and fully unit-tested; the same
logic runs on the server (SSE diff) and in the browser (component render).

---

## Where Stages Render

### `VideoList` (library grid)

`VideoList` fetches the initial video list via `GET /api/videos` and renders
`t('stages.<stage>')` for each card by calling `deriveUploadStage(video)`.

On mount, it opens an `EventSource('/api/videos/stream')` and listens for
`video-updated` events. Each event is merged into the local array by `id` —
updating `status`, `processingStatus`, `thumbnailStatus`, `thumbnailUrl`, and
`storageConfirmedAt` in place. The next render re-derives the stage from the
merged data; no full refetch is needed.

### `UploadArea` (active upload card)

`UploadArea` captures the `videoId` returned by `POST /api/upload` as
`serverVideoId`. Once the upload bytes are fully transferred and the `complete`
call succeeds, the component subscribes to the SSE stream and filters incoming
`video-updated` events by `serverVideoId`. Matching events advance the active
card through stages 3–6, giving the operator a live view of the transcoding
pipeline while the file processes.

The `EventSource` is closed when the card is dismissed or the component unmounts.

---

## Data Flow

```
POST /api/upload  →  returns videoId (serverVideoId)
         │
multipart chunks
         │
POST /api/upload/complete
         │
         ├── emits upload.completed → streaming-ingest → RabbitMQ
         │
MinIO/S3 ObjectCreated webhook → streaming-ingest
         │  patches storageConfirmedAt on the video document
         │
GET /api/videos/stream  (polls ingest every 3 s)
         │  diffs snapshot; propagates storageConfirmedAt in video-updated
         ▼
UploadArea (correlates on serverVideoId)   VideoList (merges by id)
         │                                          │
   deriveUploadStage()                    deriveUploadStage()
         │                                          │
   stage badge on active card             stage badge in library grid
```

**`autoReadyAfterUpload` removed:** the former `AUTO_READY_AFTER_UPLOAD_ENABLED`
flag injected a synthetic `status=ready` after a 2 s timeout, causing the card to
skip straight from stage 2 to stage 6. Now the only path to stage 6 is a real
`processingStatus=ready` signal from the transcode worker, delivered via SSE.

---

## AWS Caveat: `UPLOAD_RAW_PREFIX_ENABLED`

On AWS, `UPLOAD_RAW_PREFIX_ENABLED=true` **must** be set so that object keys are
stored as `raw/<videoId>/<filename>` instead of `<videoId>/<filename>`.

This is required for two reasons:

1. **EventBridge notification filter** — the S3 bucket notification rule that
   routes `ObjectCreated` events to the `streaming-ingest` API Destination is
   filtered on prefix `raw/`. Without the prefix, no webhook fires, `storageConfirmedAt`
   is never set, and stage 3 (`available`) never appears in the UI.

2. **S3→Batch transcode trigger** — the same `raw/` prefix filter guards the S3
   Batch job that enqueues the transcode. Without it, transcoding never starts and
   stages 4–6 are also unreachable.

On local MinIO, leave `UPLOAD_RAW_PREFIX_ENABLED=false` (the default). MinIO
webhooks fire on all keys and the `streaming-ingest` MinIO adapter does not
require the `raw/` prefix.

**Degraded mode:** if the storage webhook is not wired (e.g. missing
`UPLOAD_RAW_PREFIX_ENABLED` on AWS), the UI skips stage 3 and jumps from stage 2
to stage 4. Stages 4–6 still surface correctly once the transcode worker updates
`processingStatus`.
