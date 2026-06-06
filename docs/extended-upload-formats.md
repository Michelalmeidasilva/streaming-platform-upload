# Extended upload formats (.mkv, .y4m, .yuv)

## Motivation
Operators need to upload Matroska (`.mkv`), YUV4MPEG2 (`.y4m`) and headerless
raw YUV (`.yuv`) in addition to the previous set (`.mp4`, `.mov`, `.m4v`,
`.webm`, `.m3u8`).

## What changed
- **Allowlists** kept in sync in three places:
  - `src/app/api/upload/route.ts` — `ALLOWED_EXTENSIONS` (server-side gate).
  - `src/lib/cmaf.ts` — `SUPPORTED_FORMATS` (client-side pre-check).
  - `src/components/UploadArea.tsx` — `accept` attribute + format badges +
    validation message.
- **MIME handling** — MIME enforcement is skipped (`NO_CANONICAL_MIME_EXTENSIONS`)
  for `.y4m`/`.yuv` (no canonical MIME; browsers send empty or
  `application/octet-stream`) **and `.mkv`**. Matroska's MIME varies by
  browser/OS — Safari/iOS sends `video/matroska`, others `video/x-matroska`,
  `application/x-matroska`, `video/mkv` or empty — so a strict allow-list rejected
  legitimate `.mkv` files with `400 Unsupported MIME type`. The extension
  allow-list is the gate; the MIME guard is not applied to these extensions.

## Raw `.yuv` geometry
A headerless `.yuv` has no resolution/fps/pixel-format, so the transcoder needs
it supplied. On selecting a `.yuv` file the UI prompts for:
- frame size `WIDTHxHEIGHT` (e.g. `1920x1080`)
- frame rate (fps)
- pixel format (defaults to `yuv420p`)

This `rawVideo` object is:
- sent in the `POST /api/upload` body and validated server-side
  (`RAW_VIDEO_EXTENSIONS`; rejects `.yuv` without positive width/height/fps), and
- emitted on the `upload.started` event (`emitUploadStarted(videoId, filename,
  rawVideo)` → `initiateUpload`), from where the gateway persists and forwards it
  to the transcoder.

## API contract
`POST /api/upload`
```jsonc
{
  "filename": "raw.yuv",
  "size": 12345678,
  "mimeType": "application/octet-stream", // optional; ignored for .y4m/.yuv
  "rawVideo": { "width": 1920, "height": 1080, "fps": 30, "pixelFormat": "yuv420p" }
}
```
`rawVideo` is required only for `.yuv`. 400 is returned for unsupported
extensions, disallowed MIME on typed formats, files over 5 GB, or `.yuv` missing
geometry.

## Caveats / future work
- Geometry is collected via `window.prompt` (minimal, functional). A richer
  inline form/modal is a natural follow-up.
- New i18n keys live under `upload.rawVideo.*` (en/es/pt).
