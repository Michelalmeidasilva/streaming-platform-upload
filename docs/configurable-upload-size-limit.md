# Configurable upload size limit

## Motivation
The maximum upload file size was hardcoded at 5GB in two independent places
(server API route and client-side validation), plus the limit value was baked
into the localized error messages. Operators need to raise the ceiling (e.g. to
10GB) per environment without a code change.

## What changed
A single source of truth was introduced — `src/lib/uploadLimits.ts` — exposing:

- `getMaxFileSizeGB()` — the configured limit in GB (default `5`).
- `getMaxFileSizeBytes()` — the same value in bytes.

Both the server gate (`src/app/api/upload/route.ts`) and the client pre-check
(`src/lib/cmaf.ts`) now call this module instead of using a local constant.

## Configuration
Because the limit is enforced on both sides of the wire, it is exposed through
two env vars (set both to the same value):

| Var | Scope | Notes |
|---|---|---|
| `UPLOAD_MAX_FILE_SIZE_GB` | Server only | Read in the API route (Node runtime). Takes precedence. |
| `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB` | Client bundle | `NEXT_PUBLIC_` prefix is required for Next.js to inline the value into the browser bundle; it is the fallback the client reads. |

Both default to **5** (GB). Example — allow 10GB uploads:

```env
UPLOAD_MAX_FILE_SIZE_GB=10
NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB=10
```

### Resolution & validation rules
`getMaxFileSizeGB()` resolves in this order:
1. `UPLOAD_MAX_FILE_SIZE_GB` (server var) if present.
2. `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB` (client fallback) otherwise.
3. Default `5` GB.

Non-numeric, zero or negative values fall back to the 5GB default (fail-safe —
a misconfigured env never disables or inverts the limit). Both var names are
referenced literally in the module so Next.js can statically inline the
`NEXT_PUBLIC_` value at build time.

## Localized error message
The `upload.validation.fileTooLarge` string (EN/ES/PT) now interpolates the
configured limit via `{{limit}}` instead of a hardcoded "5GB". The client passes
`{ limit: \`${getMaxFileSizeGB()}GB\` }` from `UploadArea.tsx`; the server API
returns `File exceeds maximum allowed size of <N> GB`.

## Caveats
- **Set both vars together.** Setting only the server var leaves the browser
  pre-check at the default, so oversize files are rejected client-side before the
  server ever sees them (and vice-versa).
- **Multipart headroom is fine at 10GB.** With the default 100MB chunk
  (`UPLOAD_CHUNK_SIZE_BYTES=104857600`), 10GB is ~100 parts — well within the S3
  limit of 10,000 parts / 5TB per object.
- **Downstream limit is independent.** `streaming-transcode` enforces its own
  `TRANSCODE_MAX_FILE_SIZE_MB` (default `0` = disabled). If that is set in an
  environment, raise it too or the transcoder will reject the larger source.
