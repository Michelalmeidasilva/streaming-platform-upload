# Streaming Format Controls (Upload UI)

## Motivation

Operators previously could only choose codec and resolution at upload time. Protocol
(HLS/DASH), segment duration, and per-rendition bitrate were fixed in the transcoder.
This feature surfaces all four as upload-time choices so the operator controls the exact
packaging/encoding the pipeline produces.

## UI (UploadArea)

The selector panel above the drop zone now has, in addition to **Codec** (radio, one) and
**Resolução** (checkboxes, ≥1):

- **Protocolo** — checkboxes **HLS** and **DASH**, both checked by default, at least one
  required. Upload is blocked with "Selecione pelo menos um protocolo." when none is checked.
- **Duração de segmento** — a preset `<select>` of `2s / 4s / 6s` (default 6). Presets are
  restricted to multiples of the 2 s GOP so segments stay keyframe-aligned.
- **Bitrate** — a kbps `<input type="number">` shown next to each *selected* resolution,
  pre-filled with the ladder default (360→800, 480→1400, 720→2800, 1080→5000). Leaving it
  blank means **auto** (the transcoder picks from its own ladder).

## Contract (the `transcode` field)

`POST /api/upload` carries an optional `transcode` object on `upload.started`:

```json
{
  "codecs": ["h265"],
  "protocols": ["hls", "dash"],
  "segmentSeconds": 6,
  "renditions": [
    { "width": 1280, "height": 720,  "codec": "h265", "bitrateKbps": 2800 },
    { "width": 1920, "height": 1080, "codec": "h265", "bitrateKbps": 5000 }
  ]
}
```

`bitrateKbps` is omitted per rendition when the operator left the field blank.

## Data flow

`UploadArea` state (`selectedProtocols`, `segmentSeconds`, `bitrateByResolution`) →
`buildTranscodeSelection(codecs, resolutions, opts)` in `src/lib/transcodeOptions.ts` →
`POST /api/upload` → `UploadService.initiateUpload` → `emitUploadStarted` → `streaming-ingest`
persists it on the video record → storage webhook forwards it on `upload.completed` →
`streaming-transcode`.

## Validation

| Field | Rule |
|---|---|
| codec | exactly one (radio) |
| protocols | ≥1 of {hls,dash} — else upload blocked |
| resolutions | ≥1 — else upload blocked |
| segmentSeconds | one of 2/4/6 (select guarantees) |
| bitrateKbps | blank = auto, else 100–20000 |

`buildTranscodeSelection` returns `null` (blocking the upload) when codecs, resolutions, or
protocols is empty. `opts` is optional; omitting it defaults to both protocols and 6 s.

## Related

- `src/lib/transcodeOptions.ts` — constants + `buildTranscodeSelection`
- `src/lib/events.ts` — `TranscodeSelection` interface
- `docs/codec-resolution-selection.md` — the prior codec/resolution work
- `../../docs/design-docs/specs/2026-06-10-streaming-format-controls-design.md` — design spec
