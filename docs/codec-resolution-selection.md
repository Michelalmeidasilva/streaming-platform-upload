# Codec and Resolution Selection at Upload

## Motivation

Previously `streaming-transcode` applied a fixed bitrate ladder (H.264, 360p–1080p)
to every video. Different content types have different needs: a live-event archive
may only need 720p/1080p in H.264 for maximum compatibility, while a premium feature
film benefits from AV1 at all resolutions for bandwidth savings. Operators now specify
their intent at upload time, avoiding wasted transcode cycles and storage.

## UI

A selector panel rendered above the drop zone in `UploadArea` contains two groups:
**Codec** (a **radio group — exactly one**) and **Resolução** (Resolution — checkboxes,
one or more).

**Codecs available (pick one):**
- H.264 (AVC) — default, widest device support
- H.265 (HEVC) — better compression; some legacy clients unsupported
- AV1 — best compression; a warning is displayed ("AV1 é o encode mais lento — pode
  demorar bastante.") because AV1 software encoding is CPU-intensive

**Resolutions available:** 360p (640×360), 480p (854×480), 720p (1280×720), 1080p (1920×1080)

**Defaults:** H.264 + 720p + 1080p

**Validation:** A codec is always selected (radio), so only the resolution list can be
empty — when it is, a validation message is shown and the upload is blocked (the
`handleFiles` callback returns early). The `transcode` payload still uses a `codecs` array
(length 1) so the backend contract is unchanged.

## Contract (API)

`POST /api/upload` accepts an optional `transcode` field:

```json
{
  "filename": "movie.mp4",
  "size": 123456789,
  "transcode": {
    "codecs": ["h264"],
    "renditions": [
      { "width": 1280, "height": 720,  "codec": "h264" },
      { "width": 1920, "height": 1080, "codec": "h264" }
    ]
  }
}
```

The `renditions` array is the full **codec×resolution product** — every combination
of selected codec and selected resolution. The product is computed client-side by
`buildTranscodeSelection` in `src/lib/transcodeOptions.ts` so the API receives a flat,
unambiguous list.

## Data Flow

```
UploadArea (state: selectedCodecs, selectedResolutions)
  │
  ├─ buildTranscodeSelection(selectedCodecs, selectedResolutions)
  │       → TranscodeSelection | null
  │
  ├─ POST /api/upload { ..., transcode }
  │
  └─ api/upload/route.ts → uploadService.initiateUpload(..., transcode)
         │
         └─ videoEvents.emitUploadStarted(videoId, filename, rawVideo, subtitles, transcode)
                │
                └─ upload.started event → streaming-ingest → RabbitMQ → streaming-transcode
```

No intermediate hook or context is involved: `UploadArea` directly calls the `/api/upload`
route via `fetch`, mirroring the existing `rawVideo` path.

## Defaults

| Setting | Default |
|---------|---------|
| Codecs | `['h264']` |
| Resolutions | `['720p', '1080p']` |

Exported from `src/lib/transcodeOptions.ts` as `DEFAULT_CODECS` and `DEFAULT_RESOLUTIONS`.

## AV1 Caveat

AV1 software encoding (libsvtav1 / libaom-av1) is 5–20× slower than H.264 on the same
hardware. The UI warns the operator before they select it. Operators should avoid AV1 on
time-sensitive ingestion pipelines unless hardware-accelerated encoders are available.

## Related

- SPEC.md — Codec and Resolution Selector section
- `src/lib/transcodeOptions.ts` — codec/resolution constants and `buildTranscodeSelection`
- `src/lib/events.ts` — `TranscodeSelection` interface
- `src/lib/VideoEventEmitter.ts` — `emitUploadStarted` signature
- `src/lib/services/UploadService.ts` — `initiateUpload` last parameter
- `docs/design-docs/specs/2026-06-09-codec-resolution-selection-design.md` — original spec
