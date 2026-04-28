# Thumbnail Generation Feature

## Overview

When a video is uploaded to the platform, a thumbnail image is automatically extracted and stored. If extraction fails for any reason, a dynamic placeholder image is generated using video metadata.

## How It Works

### Success Path

1. User uploads video file (multipart or direct upload)
2. Upload completes → API returns `{ thumbnailStatus: 'pending' }`
3. Background task spawns to extract thumbnail
4. FFmpeg extracts frame at 2-second mark
5. Frame is scaled to 640×360 and output as JPEG
6. JPEG is uploaded to storage at `thumbnails/{videoId}.jpg`
7. `video.thumbnail.generated` event is emitted
8. Client receives event → updates thumbnail URL in UI

**Timeline:** Upload returns in <100ms, thumbnail available in storage within 1-2 seconds.

### Fallback Path

If FFmpeg extraction fails (unsupported codec, corrupted file, timeout, etc.):

1. Extraction attempt times out or fails
2. FallbackGenerator creates 640×360 placeholder image
3. Placeholder includes filename, upload date, and play icon
4. Placeholder is uploaded to storage at `thumbnails/{videoId}-fallback.jpg`
5. `video.thumbnail.fallback` event is emitted with failure reason
6. Client receives event → updates thumbnail with fallback image

**Failure reasons:**
- `ffmpeg_timeout` — Extraction took >5 seconds
- `unsupported_codec` — Video uses codec not supported by FFmpeg
- `corrupted_file` — Video file is damaged
- `network_error` — Could not download video for processing
- `storage_error` — Could not upload thumbnail to storage

## API Contract

### POST /api/upload/complete

**Response:**
```json
{
  "success": true,
  "video": {
    "id": "abc123",
    "filename": "My Video.mp4",
    "size": 1000000,
    "status": "processing",
    "url": "https://storage.example.com/videos/abc123.mp4",
    "thumbnailUrl": null,
    "thumbnailStatus": "pending",
    "createdAt": "2026-04-28T10:00:00Z",
    "updatedAt": "2026-04-28T10:00:00Z"
  }
}
```

### Events

**video.thumbnail.generated**
```json
{
  "type": "video.thumbnail.generated",
  "videoId": "abc123",
  "thumbnailUrl": "https://storage.example.com/thumbnails/abc123.jpg",
  "extractedAt": "2026-04-28T10:00:02Z"
}
```

**video.thumbnail.fallback**
```json
{
  "type": "video.thumbnail.fallback",
  "videoId": "abc123",
  "thumbnailUrl": "https://storage.example.com/thumbnails/abc123-fallback.jpg",
  "reason": "ffmpeg_timeout",
  "fallbackAt": "2026-04-28T10:00:05Z"
}
```

## Storage Structure

```
s3://bucket/
├── videos/
│   ├── {videoId}/filename.mp4
│   └── ...
└── thumbnails/
    ├── {videoId}.jpg              (extracted thumbnail)
    ├── {videoId}-fallback.jpg     (fallback placeholder)
    └── ...
```

## Implementation Details

### FFmpeg Command

```bash
ffmpeg -i <presigned_url> \
  -ss 2 \
  -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
  -f image2 \
  -vframes 1 \
  -q:v 5 \
  <output.jpg>
```

**Parameters:**
- `-ss 2` — Seek to 2 seconds
- `scale=640:360` — Target resolution
- `force_original_aspect_ratio=decrease` — Maintain aspect ratio
- `pad=...` — Center image on 640×360 canvas
- `-vframes 1` — Extract exactly one frame
- `-q:v 5` — JPEG quality (high quality ~90%)

### Fallback Image

Generated dynamically using Node.js `sharp` library:
- 640×360 JPEG
- Dark gradient background (#1a1a1a → #262626)
- Centered play icon in platform primary color (#00adef)
- Filename text overlay (truncated to 40 chars)
- Upload date overlay
- ~15-20KB file size

### Concurrency Handling

If `extract()` is called twice for the same video within the same session (race condition):
- Second call is deduplicated
- Only one extraction attempt proceeds
- Other callers receive event for the same extraction

### Error Handling

| Error | Action |
|-------|--------|
| FFmpeg timeout (>5s) | Use fallback, emit `video.thumbnail.fallback` with reason `ffmpeg_timeout` |
| Unsupported codec | Use fallback, emit `video.thumbnail.fallback` with reason `unsupported_codec` |
| Corrupted video file | Use fallback, emit `video.thumbnail.fallback` with reason `corrupted_file` |
| Network error | Retry presigned URL up to 2 times, then fallback |
| Storage upload fails | Retry up to 2 times, log error (do NOT fail upload) |

## Monitoring & Metrics

### Key Metrics

- **Extraction success rate**: % of videos with extracted thumbnails
- **Fallback rate**: % of videos using fallback images
- **Average extraction time**: Time from upload complete to thumbnail ready
- **Top failure reasons**: Count of each failure type

### Logging

Every extraction attempt logs:
```json
{
  "level": "info|warn|error",
  "message": "thumbnail_extraction_<status>",
  "videoId": "abc123",
  "durationMs": 1200,
  "size": 25600,
  "status": "success|fallback|failed",
  "reason": "ffmpeg_timeout|...",
  "timestamp": "2026-04-28T10:00:02Z"
}
```

## Troubleshooting

### Thumbnails Not Generated

1. Check FFmpeg is installed: `ffmpeg -version`
2. Check logs for extraction errors
3. Verify storage adapter can upload files
4. Check network connectivity to video source

### Fallback Images Not Generated

1. Verify `sharp` library is installed: `npm list sharp`
2. Check SVG rendering is working
3. Verify storage adapter can upload files

### Thumbnail Events Not Reaching Client

1. Verify EventEmitter is emitting events
2. Check event listener is attached correctly
3. Check browser console for errors

## Future Improvements

- Configurable extraction frame time (currently hardcoded to 2s)
- Multiple thumbnail sizes for different use cases
- Thumbnail extraction from multiple frames
- User-initiated thumbnail re-extraction
- Thumbnail preview in upload UI before completion
- Backfill thumbnails for existing videos
