# Thumbnail Derivation and Real-Time Status Stream

## Motivation

The admin upload UI needs to show two things as soon as the transcode worker
finishes: the processing status badge (processing → ready) and the video thumbnail.
Polling on page load is too slow and forces a manual refresh. This feature adds
server-sent events (SSE) so the UI updates automatically, and derives a usable
thumbnail URL from the storage key convention established by streaming-transcode.

---

## Thumbnail URL Derivation

### Logic (`src/app/api/videos/thumbnail.ts`)

```
if video has explicit thumbnailUrl → use it
else if thumbnailStatus === 'ready'
  → storageAdapter.getPublicUrl('thumbnails/<id>.jpg')
else → null
```

`getPublicUrl` builds a **public, unsigned** path-style URL using
`MINIO_PUBLIC_ENDPOINT` (e.g. `http://localhost:9000`). The URL is not presigned
because:

1. Presigned URLs embed internal Docker hostnames (`http://minio:9000`) that
   browsers on the host cannot resolve.
2. They expire; cached HTML/JS would render broken `<img>` tags after the TTL.

For production S3, `getPublicUrl` delegates to the presigned host's public base
URL (bucket policy must allow public read on `thumbnails/*`).

### Default Fallback

When `thumbnailUrl` is null, `VideoList` renders `public/default-thumbnail.png` —
a neutral placeholder that prevents layout shift and empty image boxes.

---

## SSE Status Stream

### Endpoint

```
GET /api/videos/stream
Content-Type: text/event-stream
Cache-Control: no-cache
Auth: cookie (same session as the admin UI)
```

### Behavior

1. On connection, fetches the current video list from the ingest service and
   stores it as the baseline snapshot.
2. Every **3 seconds**, fetches again and diffs against the snapshot.
3. For each video whose `status`, `processingStatus`, or `thumbnailStatus` changed,
   emits:

```
event: video-updated
data: {"id":"<id>","status":"<s>","processingStatus":"<ps>","thumbnailStatus":"<ts>","thumbnailUrl":"<url|null>"}

```

4. Every **15 seconds** (regardless of changes), emits a heartbeat comment to
   prevent proxies/load-balancers from closing idle connections:

```
: heartbeat

```

5. The connection is closed when the client disconnects (detected via
   `request.signal` abort).

### Client Integration (`VideoList`)

`VideoList` opens an `EventSource('/api/videos/stream')` on mount and listens for
`video-updated` events. On each event it merges the payload into the local video
array by `id`, updating the badge and thumbnail in place — no full refetch needed.
The `EventSource` is closed on component destroy.

### Caveats

- The SSE endpoint polls ingest over HTTP; it is not a RabbitMQ consumer. The
  3 s poll interval is a deliberate trade-off: low complexity, acceptable latency
  for an admin UI (not a real-time game feed).
- If the ingest service is unreachable, errors are logged and the stream continues
  sending heartbeats so the browser does not immediately reconnect in a tight loop.
- The endpoint is cookie-authenticated; it does not accept API key auth. External
  consumers should use the REST endpoints directly.
