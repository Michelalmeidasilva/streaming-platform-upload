# Fix: S3 Direct Upload Broken by AWS SDK v3 Flexible Checksums

## Problem

After deploying to Vercel (production), all direct browser uploads to AWS S3 failed silently.
The upload flow reached the presigned URL PUT step but S3 responded with HTTP 400.

## Root Cause

AWS SDK v3 **>= 3.500.0** (released early 2024) enabled "flexible checksums" by default
(`requestChecksumCalculation: 'WHEN_SUPPORTED'`). When the server generates a presigned URL
for `PutObjectCommand` or `UploadPartCommand`, the SDK now automatically injects:

```
x-amz-checksum-crc32=AAAAAA%3D%3D
x-amz-sdk-checksum-algorithm=CRC32
```

into the URL's signed query parameters. `AAAAAA==` is a zero/placeholder CRC32 value signed
at URL-generation time. S3 then enforces that the actual PUT request must include the
`x-amz-checksum-crc32` header with the **real** CRC32 of the uploaded bytes.

The `UploadArea` component performs a plain browser `fetch`:

```ts
await fetch(presignedUrl, { method: 'PUT', body: chunkBlob })
```

The browser has no way to compute CRC32 before the upload, so the header is never sent.
S3 rejects the request with 400 (`x-amz-checksum-crc32 header is required`).

This was confirmed by inspecting a presigned URL captured in `.env` during a local debug
session against production credentials.

## Fix

Set `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'`
on the `S3Client` constructor in `src/lib/storage/S3Adapter.ts`. These flags revert the SDK
to the pre-3.500 behaviour: checksums are only computed when the S3 API explicitly mandates
them (e.g. `DeleteObjects`), not added speculatively to every operation including presigned URLs.

```ts
this.client = new S3Client({
  // ...
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

## Caveats

- Server-side `upload()` and `uploadPart()` calls still include explicit `ChecksumSHA256`
  when available (passed in from `UploadService`), so integrity is preserved on the
  server-to-S3 path.
- Presigned URL uploads do not carry end-to-end checksums. If integrity verification on
  direct uploads is required in the future, the client must compute CRC32 in a Web Worker
  before calling `/api/upload` and include it in the request body so the server can embed
  the correct value into the presigned URL.

## S3 Bucket CORS (prerequisite)

Direct browser uploads require the S3 bucket to have a CORS rule that allows `PUT` from
the Vercel origin. Without it, the preflight `OPTIONS` fails before the checksum issue
is even reached. Ensure the bucket has a rule similar to:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedOrigins": ["https://streaming-platform-upload.vercel.app"],
  "ExposeHeaders": ["ETag"]
}]
```
