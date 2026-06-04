# Sidecar subtitles (.srt)

## Motivation
Operators attach `.srt` subtitles to a video by dropping them in the same upload
batch as the video file.

## Pairing
In `UploadArea`, dropped files are split into videos and `.srt` files.
`matchSubtitles` pairs subtitles to a video by basename:
- `movie.srt` and `movie.en.srt` → `movie.mp4`.
- When exactly one video is uploaded, any otherwise-unmatched `.srt` is attached
  to it.

The language is inferred from the filename (`movie.en.srt` → `en`,
`movie.pt-BR.srt` → `pt-br`; bare `movie.srt` → none) and used as the label
(uppercased).

## Upload mechanics
`.srt` content cannot be in `upload.started` (which is emitted inside
`initiateUpload`, before the video object exists), so:
1. The client sends per-track metadata (`subtitles: [{ language, label }]`) in
   the `POST /api/upload` body.
2. `initiateUpload` computes a key per track (`subtitles/<videoId>/<lang>.srt`),
   presigns a PUT, returns them as `subtitleUploads`, and forwards the resulting
   `SubtitleRef[]` on `upload.started` so the gateway can persist/attach them.
3. The client PUTs each `.srt` File to its presigned URL.

## API contract
`POST /api/upload`
```jsonc
{
  "filename": "movie.mp4",
  "size": 12345678,
  "subtitles": [ { "language": "en", "label": "EN" } ]
}
```
Response adds:
```jsonc
{
  "subtitleUploads": [
    { "objectKey": "subtitles/<videoId>/en.srt", "url": "https://...", "language": "en", "label": "EN" }
  ]
}
```

## Caveats / future work
- Best-effort ordering: the `.srt` (small) is uploaded right after initiate and
  should land before transcoding reads it; the video upload is larger/slower.
- Subtitles can only be attached during the video's upload (per the chosen
  design); adding subtitles to an already-published video would require a
  separate flow + manifest rewrite.
